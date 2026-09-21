import { CommandHandler } from "@zudojs/cqrs";
import type { AdminFixture } from "@betng/contracts";
import { isConflictError } from "@zudojs/database";
import { MATCH_COMMAND, SCHEDULER } from "../../../../constants/index.js";
import { InvalidRequestError, MatchConflictError } from "../../../../errors/index.js";
import { toAdminFixture } from "../../../../models/index.js";
import { recordCatalogueAudit } from "../../catalogueAudit.js";
import type { HandlerDependencies } from "../../match.dependencies.js";
import type { CreateFixtureCommand } from "./createFixture.command.js";

export class CreateFixtureHandler extends CommandHandler<CreateFixtureCommand, AdminFixture> {
  public readonly commandType = MATCH_COMMAND.CREATE_FIXTURE;

  private readonly deps: HandlerDependencies;

  public constructor(deps: HandlerDependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: CreateFixtureCommand): Promise<AdminFixture> {
    const { request, actor } = command;
    const { catalogue, matches, timing } = this.deps;
    const now = this.deps.clock();
    const league = await catalogue.findLeague(request.leagueId);

    if (league === undefined || league.status === "ARCHIVED") {
      throw new InvalidRequestError("No active league with this id.", "leagueId");
    }

    if (request.homeTeamId === request.awayTeamId) {
      throw new InvalidRequestError("A team cannot play itself.", "awayTeamId");
    }

    for (const [path, teamId] of [["homeTeamId", request.homeTeamId], ["awayTeamId", request.awayTeamId]] as const) {
      const team = await catalogue.findTeam(teamId);

      if (team === undefined || team.leagueId !== league.id || team.status !== "ACTIVE") {
        throw new InvalidRequestError("No active team with this id in the league.", path);
      }
    }

    const kickoffAt = new Date(request.kickoffAt);
    const bettingClosesAt = new Date(kickoffAt.getTime() - timing.bettingCloseLeadSeconds * 1000);

    if (bettingClosesAt.getTime() < now.getTime() + SCHEDULER.ROUND_MARGIN_SECONDS * 1000) {
      throw new InvalidRequestError("Kick-off must leave time for betting to open and close.", "kickoffAt");
    }

    const round = await matches.latestScheduledRound(league.id);
    const season = request.season ?? round?.season ?? 1;
    const matchday = request.matchday ?? (round !== undefined && round.season === season ? round.matchday : 1);

    try {
      const [matchId] = await matches.createFixtures(
        [
          {
            leagueId: league.id,
            season,
            matchday,
            homeTeamId: request.homeTeamId,
            awayTeamId: request.awayTeamId,
            kickoffAt,
            bettingClosesAt,
          },
        ],
        { source: "ADMIN", actor: actor.label, at: now },
      );
      const created = matchId === undefined ? undefined : await matches.findMatch(matchId);

      if (created === undefined) throw new MatchConflictError("This pairing already exists in that matchday.");

      const fixture = toAdminFixture(created);

      await recordCatalogueAudit(this.deps, actor, "fixture_created", "match", created.id, fixture);

      return fixture;
    } catch (error) {
      if (isConflictError(error)) throw new MatchConflictError("This pairing already exists in that matchday.");

      throw error;
    }
  }
}
