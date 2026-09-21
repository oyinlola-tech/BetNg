import { QueryHandler } from "@zudojs/cqrs";
import { MATCH_QUERY } from "../../../../constants/index.js";
import type { AdminMatchDto } from "../../../../dtos/index.js";
import { MatchNotFoundError } from "../../../../errors/index.js";
import { toAdminMatch } from "../../../../models/index.js";
import type { HandlerDependencies } from "../../match.dependencies.js";
import type { GetAdminMatchQuery } from "./getAdminMatch.query.js";

export class GetAdminMatchHandler extends QueryHandler<
  GetAdminMatchQuery,
  AdminMatchDto
> {
  public readonly queryType = MATCH_QUERY.GET_ADMIN_MATCH;

  private readonly deps: HandlerDependencies;

  public constructor(deps: HandlerDependencies) {
    super();
    this.deps = deps;
  }

  public async execute(query: GetAdminMatchQuery): Promise<AdminMatchDto> {
    const found = await this.deps.matches.findMatch(query.matchId);

    if (found === undefined) throw new MatchNotFoundError(query.matchId);

    return toAdminMatch(
      found,
      await this.deps.matches.listTransitions(found.id),
    );
  }
}
