import { CommandHandler } from "@zudojs/cqrs";
import { isConflictError } from "@zudojs/database";
import type { CashierCredentials } from "@betng/contracts";
import {
  AUDIT_ACTION,
  AUDIT_ENTITY,
  IDENTITY_COMMAND,
  LIST_LIMIT,
  SECURITY,
} from "../../../../constants/index.js";
import { ConflictError } from "../../../../errors/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { issueTemporarySecrets, normaliseUsername } from "../../../../utils/index.js";
import { assertMayManage } from "../../shopStaff.guard.js";
import type { CreateShopCashierCommand } from "./createShopCashier.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "hasher" | "audit">;

/**
 * An owner staffing their own shop. The shop is the actor's, never the request's, so no body can reach
 * another shop. The password and PIN are returned once and stored only as hashes.
 */
export class CreateShopCashierHandler extends CommandHandler<CreateShopCashierCommand, CashierCredentials> {
  public readonly commandType = IDENTITY_COMMAND.CREATE_SHOP_CASHIER;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: CreateShopCashierCommand): Promise<CashierCredentials> {
    const { store, hasher, audit } = this.deps;
    const { actor, request } = command;

    assertMayManage(actor, request.role);

    const username = normaliseUsername(request.username);
    const secrets = await issueTemporarySecrets();
    const [passwordHash, pinHash] = await Promise.all([hasher.hash(secrets.password), hasher.hash(secrets.pin)]);
    const expiresAt = new Date(Date.now() + SECURITY.TEMPORARY_CREDENTIALS_TTL_MS);

    try {
      await store.transaction(async (repositories) => {
        const staff = await repositories.cashiers.listByShop(actor.shopId, LIST_LIMIT.CASHIERS);

        if (staff.length >= LIST_LIMIT.CASHIERS) {
          throw new ConflictError("This shop already has the maximum number of cashiers.");
        }

        const cashier = await repositories.cashiers.create({
          shopId: actor.shopId,
          username,
          displayName: request.displayName.trim(),
          role: request.role,
          passwordHash,
          pinHash,
          credentialsExpireAt: expiresAt,
        });

        await audit.write(repositories, {
          actorId: actor.id,
          actorRole: actor.role,
          actorName: actor.name,
          action: AUDIT_ACTION.CASHIER_CREATED,
          entityType: AUDIT_ENTITY.CASHIER,
          entityId: cashier.id,
          after: { shopId: actor.shopId, username, displayName: cashier.displayName, role: cashier.role },
          severity: "NOTICE",
          requestId: actor.requestId,
        });
      });
    } catch (error) {
      if (isConflictError(error)) {
        throw new ConflictError(`Username ${username} is already taken in this shop.`);
      }

      throw error;
    }

    return {
      username,
      temporaryPassword: secrets.password,
      temporaryPin: secrets.pin,
      expiresAt: expiresAt.toISOString(),
    };
  }
}
