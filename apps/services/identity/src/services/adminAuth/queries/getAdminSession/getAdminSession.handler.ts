import { QueryHandler } from "@zudojs/cqrs";
import type { AdminSession } from "@betng/contracts";
import { IDENTITY_QUERY } from "../../../../constants/index.js";
import { toAdminUser } from "../../../../dtos/index.js";
import { UnauthenticatedError } from "../../../../errors/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import type { GetAdminSessionQuery } from "./getAdminSession.query.js";

type Dependencies = Pick<HandlerDependencies, "resolver">;

export class GetAdminSessionHandler extends QueryHandler<GetAdminSessionQuery, AdminSession> {
  public readonly queryType = IDENTITY_QUERY.GET_ADMIN_SESSION;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(query: GetAdminSessionQuery): Promise<AdminSession> {
    if (query.token === undefined) {
      throw new UnauthenticatedError();
    }

    const resolved = await this.deps.resolver.resolveAs(query.token, "ADMIN");

    return {
      token: query.token,
      expiresAt: resolved.session.expiresAt.toISOString(),
      admin: toAdminUser(resolved.admin),
    };
  }
}
