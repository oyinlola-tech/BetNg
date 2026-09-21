import { CommandHandler } from "@zudojs/cqrs";
import {
  ADMIN_ROLE_PERMISSIONS,
  IDENTITY_COMMAND,
  SHOP_ROLE_PERMISSIONS,
} from "../../../../constants/index.js";
import type { AuthenticatedActorDto } from "../../../../dtos/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import type { AuthenticateCommand } from "./authenticate.command.js";

type Dependencies = Pick<HandlerDependencies, "resolver">;

/** A command, not a query: resolving a token also records that the session was seen. */
export class AuthenticateHandler extends CommandHandler<AuthenticateCommand, AuthenticatedActorDto> {
  public readonly commandType = IDENTITY_COMMAND.AUTHENTICATE;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: AuthenticateCommand): Promise<AuthenticatedActorDto> {
    const resolved = await this.deps.resolver.resolve(command.token);
    const expiresAt = resolved.session.expiresAt.toISOString();

    if (resolved.kind === "CUSTOMER") {
      return {
        kind: "CUSTOMER",
        id: resolved.customer.id,
        role: "CUSTOMER",
        name: resolved.customer.displayName,
        permissions: [],
        expiresAt,
      };
    }

    if (resolved.kind === "CASHIER") {
      return {
        kind: "CASHIER",
        id: resolved.cashier.id,
        role: resolved.cashier.role,
        name: resolved.cashier.displayName,
        shopId: resolved.cashier.shopId,
        permissions: SHOP_ROLE_PERMISSIONS[resolved.cashier.role],
        expiresAt,
      };
    }

    return {
      kind: "ADMIN",
      id: resolved.admin.id,
      role: resolved.admin.role,
      name: resolved.admin.name,
      permissions: ADMIN_ROLE_PERMISSIONS[resolved.admin.role],
      expiresAt,
    };
  }
}
