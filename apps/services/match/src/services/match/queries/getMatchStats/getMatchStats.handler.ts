import { QueryHandler } from "@zudojs/cqrs";
import { asId } from "@betng/contracts";
import type { MatchStats } from "@betng/contracts";
import { validate } from "@zudojs/validation";
import { LIST_LIMIT, MATCH_QUERY } from "../../../../constants/index.js";
import {
  MatchNotFoundError,
  StatsNotAvailableError,
} from "../../../../errors/index.js";
import {
  liveStats,
  minuteAtMs,
  resultStatsSchema,
} from "../../../../utils/index.js";
import type { HandlerDependencies } from "../../match.dependencies.js";
import type { GetMatchStatsQuery } from "./getMatchStats.query.js";

export class GetMatchStatsHandler extends QueryHandler<
  GetMatchStatsQuery,
  MatchStats
> {
  public readonly queryType = MATCH_QUERY.GET_MATCH_STATS;

  private readonly deps: HandlerDependencies;

  public constructor(deps: HandlerDependencies) {
    super();
    this.deps = deps;
  }

  public async execute(query: GetMatchStatsQuery): Promise<MatchStats> {
    const found = await this.deps.matches.findMatch(query.matchId);

    if (found === undefined) throw new MatchNotFoundError(query.matchId);

    if (found.status !== "IN_PLAY" && found.status !== "COMPLETED")
      throw new StatsNotAvailableError(found.id);

    const result = await this.deps.simulation.findResult(found.id);
    const totals = validate(resultStatsSchema, result?.stats);

    if (!totals.success) throw new StatsNotAvailableError(found.id);

    const completed = found.status === "COMPLETED";
    const minute = completed
      ? 90
      : minuteAtMs(
          found.fixture.kickoffAt.getTime(),
          this.deps.clock().getTime(),
          this.deps.timing,
        );
    const revealed =
      found.revealedSequence === 0
        ? []
        : await this.deps.simulation.listEvents(found.id, {
            after: 0,
            upTo: found.revealedSequence,
            limit: LIST_LIMIT.EVENTS_MAX,
          });

    return {
      matchId: asId<"MatchId">(found.id),
      asOfMinute: minute,
      ...liveStats(totals.data, revealed, completed ? 1 : minute / 90),
    };
  }
}
