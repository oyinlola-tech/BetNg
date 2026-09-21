import { CommandHandler } from "@zudojs/cqrs";
import type { CashierCredentials } from "@betng/contracts";
import {
  AUDIT_ACTION,
  AUDIT_ENTITY,
  IDENTITY_COMMAND,
  SECURITY,
} from "../../../../constants/index.js";
import { ResourceNotFoundError } from "../../../../errors/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { issueTemporarySecrets, sha256Hex } from "../../../../utils/index.js";
import { throttleKey } from "../../../security/index.js";
import type { ResetCashierCredentialsCommand } from "./resetCashierCredentials.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "hasher" | "audit">;

export class ResetCashierCredentialsHandler extends CommandHandler<
  ResetCashierCredentialsCommand,
  CashierCredentials
> {
  public readonly commandType = IDENTITY_COMMAND.RESET_CASHIER_CREDENTIALS;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: ResetCashierCredentialsCommand): Promise<CashierCredentials> {
    const { store, hasher, audit } = this.deps;
    const { actor, shopId, cashierId } = command;
    const secrets = await issueTemporarySecrets();

    const [passwordHash, pinHash] = await Promise.all([
      hasher.hash(secrets.password),
      hasher.hash(secrets.pin),
    ]);

    const expiresAt = new Date(Date.now() + SECURITY.TEMPORARY_CREDENTIALS_TTL_MS);

    const username = await store.transaction(async (repositories) => {
      const cashier = await repositories.cashiers.findById(cashierId);

      if (cashier === undefined || cashier.shopId !== shopId) {
        throw new ResourceNotFoundError("That cashier does not exist.");
      }

      await repositories.cashiers.setCredentials(cashierId, passwordHash, pinHash, expiresAt);
      await repositories.sessions.revokeForSubjects("CASHIER", [cashierId], new Date());
      await repositories.throttles.clear(sha256Hex(throttleKey.cashierPin(cashierId)));

      await audit.write(repositories, {
        actorId: actor.id,
        actorRole: actor.role,
        actorName: actor.name,
        action: AUDIT_ACTION.CASHIER_CREDENTIALS_RESET,
        entityType: AUDIT_ENTITY.CASHIER,
        entityId: cashierId,
        after: { username: cashier.username, credentialsExpireAt: expiresAt.toISOString() },
        severity: "WARNING",
        requestId: actor.requestId,
      });

      return cashier.username;
    });

    return {
      username,
      temporaryPassword: secrets.password,
      temporaryPin: secrets.pin,
      expiresAt: expiresAt.toISOString(),
    };
  }
}
