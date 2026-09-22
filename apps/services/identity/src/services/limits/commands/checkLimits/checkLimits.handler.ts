import { CommandHandler } from "@zudojs/cqrs";
import type { LimitKind } from "@betng/contracts";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";
import type { LimitsCheckDto } from "../../../../dtos/index.js";
import type { Customer } from "../../../../generated/prisma/client.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { DEPOSIT_KINDS, limitLabel, LOSS_KINDS, restriction, WINDOW_MS } from "../../limits.helper.js";
import type { CheckLimitsCommand } from "./checkLimits.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "readModel" | "messenger">;

interface Decision {
  readonly answer: LimitsCheckDto;
  readonly limit?: LimitKind;
}

const exceeded = (limit: LimitKind, message: string): Decision => ({ answer: { allowed: false, code: "LIMIT_EXCEEDED", message }, limit });
const answered = (answer: LimitsCheckDto): Decision => ({ answer });

/**
 * `limits.check` for wallet and betting. Deposit usage counts every deposit not failed, cancelled, expired or reversed in
 * the rolling window; loss usage is net settled loss plus open stakes. Withdrawals are refused only for a restricted account,
 * so a self-excluded customer can still take money out. Every refusal is recorded for the operator's view.
 */
export class CheckLimitsHandler extends CommandHandler<CheckLimitsCommand, LimitsCheckDto> {
  public readonly commandType = IDENTITY_COMMAND.CHECK_LIMITS;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: CheckLimitsCommand): Promise<LimitsCheckDto> {
    const { store } = this.deps;
    const customer = await store.customers.findById(command.customerId);

    if (customer === undefined) {
      return { allowed: false, code: "ACCOUNT_RESTRICTED", message: "This account cannot do that." };
    }

    const { answer, limit } = await this.decide(command, customer);

    if (!answer.allowed) {
      const now = new Date();

      await store.limits.recordRefusal(customer.id, command.action, answer.code, BigInt(command.amount), now);

      // At most one warning per limit per day, however often the customer bumps into it.
      if (limit !== undefined) {
        void this.deps.messenger.notice(customer.id, {
          kind: "LIMIT_WARNING",
          title: "You have reached a limit you set",
          body: answer.message,
          data: { limit },
          dedupeKey: `limit-warning:${limit}:${now.toISOString().slice(0, 10)}`,
        });
      }
    }

    return answer;
  }

  private async decide(command: CheckLimitsCommand, customer: Customer): Promise<Decision> {
    const { store, readModel } = this.deps;
    const now = new Date();

    if (command.action === "WITHDRAWAL") {
      return answered(
        customer.status !== "ACTIVE" || customer.deletedAt !== null
          ? { allowed: false, code: "ACCOUNT_RESTRICTED", message: "This account is restricted." }
          : { allowed: true },
      );
    }

    const blocked = await restriction(store, customer, now);

    if (blocked !== undefined) {
      return answered({ allowed: false, ...blocked });
    }

    await store.limits.settleDue(customer.id, now);

    const limits = new Map((await store.limits.list(customer.id)).map((row) => [row.kind as LimitKind, row.value]));
    const amount = BigInt(command.amount);
    const sessionLimit = limits.get("session_minutes");

    if (sessionLimit !== undefined) {
      const session = await store.sessions.newestLive(customer.id, now);

      if (session !== undefined && BigInt(Math.floor((now.getTime() - session.createdAt.getTime()) / 60_000)) >= sessionLimit) {
        return exceeded("session_minutes", "You have reached your session time limit. Take a break and sign in again later.");
      }
    }

    if (command.action === "DEPOSIT") {
      for (const kind of DEPOSIT_KINDS) {
        const limit = limits.get(kind);

        if (limit !== undefined) {
          const usage = await readModel.depositUsage(customer.id, new Date(now.getTime() - WINDOW_MS[kind]));

          if (usage.used + amount > limit) {
            return exceeded(kind, `This deposit would go over your ${limitLabel(kind)}.`);
          }
        }
      }
    }

    if (command.action === "BET") {
      for (const kind of LOSS_KINDS) {
        const limit = limits.get(kind);

        if (limit !== undefined) {
          const usage = await readModel.lossUsage(customer.id, new Date(now.getTime() - WINDOW_MS[kind]));

          if (usage.used + usage.openStakes + amount > limit) {
            return exceeded(kind, `This stake could take you over your ${limitLabel(kind)}.`);
          }
        }
      }
    }

    return answered({ allowed: true });
  }
}
