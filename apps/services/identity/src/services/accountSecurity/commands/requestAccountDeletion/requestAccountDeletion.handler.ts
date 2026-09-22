import { CommandHandler } from "@zudojs/cqrs";
import { isConflictError } from "@zudojs/database";
import type { AccountDeletion } from "@betng/contracts";
import { AUDIT_ACTION, IDENTITY_COMMAND } from "../../../../constants/index.js";
import { toAccountDeletion } from "../../../../dtos/index.js";
import { InvalidInputError } from "../../../../errors/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { resolveCaller, throttleKey } from "../../../security/index.js";
import { customerAuditActor, deletionBlockers } from "../../accountSecurity.helper.js";
import type { RequestAccountDeletionCommand } from "./requestAccountDeletion.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "resolver" | "hasher" | "throttle" | "audit" | "messenger" | "readModel" | "security">;

const DAY_MS = 86_400_000;

/**
 * Schedules deletion after the cooling-off period. A retry with the same Idempotency-Key answers the stored request;
 * blockers are reported, not refused: the account stays restricted while they clear, and the job waits for them.
 */
export class RequestAccountDeletionHandler extends CommandHandler<RequestAccountDeletionCommand, AccountDeletion> {
  public readonly commandType = IDENTITY_COMMAND.REQUEST_ACCOUNT_DELETION;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: RequestAccountDeletionCommand): Promise<AccountDeletion> {
    const { store, resolver, hasher, throttle, audit, messenger, readModel, security } = this.deps;
    const { customer } = await resolveCaller(resolver, store, command.caller);
    const replay = await store.deletions.findByKey(customer.id, command.idempotencyKey);

    if (replay !== undefined) {
      return toAccountDeletion(replay, await deletionBlockers(readModel, customer.id));
    }

    const key = throttleKey.reauthenticate(customer.id);

    await throttle.assertNotLocked(key);

    if (!(await hasher.verify(command.request.password, customer.passwordHash))) {
      await throttle.recordFailure(key);
      throw new InvalidInputError("password", "That password is not right.");
    }

    await throttle.clear(key);

    const latest = await store.deletions.findLatest(customer.id);

    if (latest?.status === "PENDING") {
      return toAccountDeletion(latest, await deletionBlockers(readModel, customer.id));
    }

    const now = new Date();
    let created;

    try {
      created = await store.transaction(async (repositories) => {
        const deletion = await repositories.deletions.create({
          customerId: customer.id,
          reason: command.request.reason === undefined || command.request.reason === "" ? undefined : command.request.reason,
          idempotencyKey: command.idempotencyKey,
          scheduledFor: new Date(now.getTime() + security.deletionCoolingDays * DAY_MS),
        });

        await audit.write(repositories, {
          ...customerAuditActor(customer, command.caller.requestId),
          action: AUDIT_ACTION.DELETION_REQUESTED,
          after: { scheduledFor: deletion.scheduledFor },
          severity: "NOTICE",
        });

        return deletion;
      });
    } catch (error) {
      if (!isConflictError(error)) {
        throw error;
      }

      created = (await store.deletions.findByKey(customer.id, command.idempotencyKey)) ?? (await store.deletions.findLatest(customer.id));
    }

    if (created?.status === "PENDING") {
      void messenger.securityAlert(customer.id, { kind: "ACCOUNT_DELETION_REQUESTED", scheduledFor: created.scheduledFor });
    }

    return toAccountDeletion(created, await deletionBlockers(readModel, customer.id));
  }
}
