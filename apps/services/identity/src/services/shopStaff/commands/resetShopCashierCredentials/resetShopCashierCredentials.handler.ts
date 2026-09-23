import { CommandHandler } from "@zudojs/cqrs";
import type { CashierCredentials } from "@betng/contracts";
import { AUDIT_ACTION, AUDIT_ENTITY, IDENTITY_COMMAND, SECURITY } from "../../../../constants/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { issueTemporarySecrets } from "../../../../utils/index.js";
import { throttleKey } from "../../../security/index.js";
import { requireOwnCashier } from "../../shopStaff.guard.js";
import type { ResetShopCashierCredentialsCommand } from "./resetShopCashierCredentials.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "hasher" | "audit" | "evictor" | "throttle">;

/** The old password and PIN stop working at once, and the cashier is signed out. */
export class ResetShopCashierCredentialsHandler extends CommandHandler<
  ResetShopCashierCredentialsCommand,
  CashierCredentials
> {
  public readonly commandType = IDENTITY_COMMAND.RESET_SHOP_CASHIER_CREDENTIALS;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: ResetShopCashierCredentialsCommand): Promise<CashierCredentials> {
    const { store, hasher, audit } = this.deps;
    const { actor, cashierId } = command;

    const secrets = await issueTemporarySecrets();
    const [passwordHash, pinHash] = await Promise.all([hasher.hash(secrets.password), hasher.hash(secrets.pin)]);
    const expiresAt = new Date(Date.now() + SECURITY.TEMPORARY_CREDENTIALS_TTL_MS);

    const username = await store.transaction(async (repositories) => {
      const cashier = await requireOwnCashier(repositories, actor, cashierId);

      await repositories.cashiers.setCredentials(cashierId, passwordHash, pinHash, expiresAt);
      await repositories.sessions.revokeForSubjects("CASHIER", [cashierId], new Date());

      await audit.write(repositories, {
        actorId: actor.id,
        actorRole: actor.role,
        actorName: actor.name,
        action: AUDIT_ACTION.CASHIER_CREDENTIALS_RESET,
        entityType: AUDIT_ENTITY.CASHIER,
        entityId: cashierId,
        after: { shopId: actor.shopId, username: cashier.username },
        severity: "WARNING",
        requestId: actor.requestId,
      });

      return cashier.username;
    });

    await this.deps.throttle.clear(throttleKey.cashierPin(cashierId));
    await this.deps.evictor.flush();

    return {
      username,
      temporaryPassword: secrets.password,
      temporaryPin: secrets.pin,
      expiresAt: expiresAt.toISOString(),
    };
  }
}
