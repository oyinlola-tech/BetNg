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
import { ConflictError, ResourceNotFoundError } from "../../../../errors/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { issueTemporarySecrets, normaliseUsername } from "../../../../utils/index.js";
import type { CreateCashierCommand } from "./createCashier.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "hasher" | "audit">;

/** The generated password and PIN are returned once, here, and stored only as hashes. */
export class CreateCashierHandler extends CommandHandler<CreateCashierCommand, CashierCredentials> {
  public readonly commandType = IDENTITY_COMMAND.CREATE_CASHIER;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: CreateCashierCommand): Promise<CashierCredentials> {
    const { store, hasher, audit } = this.deps;
    const { actor, shopId, request } = command;
    const username = normaliseUsername(request.username);
    const secrets = await issueTemporarySecrets();

    const [passwordHash, pinHash] = await Promise.all([
      hasher.hash(secrets.password),
      hasher.hash(secrets.pin),
    ]);

    const expiresAt = new Date(Date.now() + SECURITY.TEMPORARY_CREDENTIALS_TTL_MS);

    try {
      await store.transaction(async (repositories) => {
        const shop = await repositories.shops.findById(shopId);

        if (shop === undefined) {
          throw new ResourceNotFoundError("That shop does not exist.");
        }

        const staff = await repositories.cashiers.listByShop(shopId, LIST_LIMIT.CASHIERS);

        if (staff.length >= LIST_LIMIT.CASHIERS) {
          throw new ConflictError("This shop already has the maximum number of cashiers.");
        }

        const cashier = await repositories.cashiers.create({
          shopId,
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
          after: {
            shopId,
            shopCode: shop.code,
            username,
            displayName: cashier.displayName,
            role: cashier.role,
          },
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
