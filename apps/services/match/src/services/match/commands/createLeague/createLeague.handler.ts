import { CommandHandler } from "@zudojs/cqrs";
import type { League } from "@betng/contracts";
import { isConflictError } from "@zudojs/database";
import { MATCH_COMMAND } from "../../../../constants/index.js";
import { MatchConflictError } from "../../../../errors/index.js";
import { toLeague } from "../../../../models/index.js";
import { recordCatalogueAudit } from "../../catalogueAudit.js";
import type { HandlerDependencies } from "../../match.dependencies.js";
import type { CreateLeagueCommand } from "./createLeague.command.js";

export class CreateLeagueHandler extends CommandHandler<CreateLeagueCommand, League> {
  public readonly commandType = MATCH_COMMAND.CREATE_LEAGUE;

  private readonly deps: HandlerDependencies;

  public constructor(deps: HandlerDependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: CreateLeagueCommand): Promise<League> {
    const { request, actor } = command;
    const { timing } = this.deps;
    const existing = await this.deps.catalogue.countLeagues();

    try {
      const league = await this.deps.catalogue.createLeague({
        name: request.name,
        code: request.code,
        slug: request.slug,
        country: request.country,
        sport: request.sport ?? "football",
        status: request.status ?? "ACTIVE",
        staggerSeconds: (existing * timing.leagueStaggerSeconds) % timing.roundCycleSeconds,
      });

      await recordCatalogueAudit(this.deps, actor, "league_created", "league", league.id, toLeague(league));

      return toLeague(league);
    } catch (error) {
      if (isConflictError(error)) throw new MatchConflictError("A league with this code or slug already exists.");

      throw error;
    }
  }
}
