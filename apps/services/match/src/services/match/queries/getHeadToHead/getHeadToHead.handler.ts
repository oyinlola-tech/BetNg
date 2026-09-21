import { QueryHandler } from "@zudojs/cqrs";
import { asId } from "@betng/contracts";
import type { HeadToHead } from "@betng/contracts";
import {
  HEAD_TO_HEAD_LIMIT,
  MATCH_QUERY,
} from "../../../../constants/index.js";
import { MatchNotFoundError } from "../../../../errors/index.js";
import type { HandlerDependencies } from "../../match.dependencies.js";
import type { GetHeadToHeadQuery } from "./getHeadToHead.query.js";

export class GetHeadToHeadHandler extends QueryHandler<
  GetHeadToHeadQuery,
  HeadToHead
> {
  public readonly queryType = MATCH_QUERY.GET_HEAD_TO_HEAD;

  private readonly deps: HandlerDependencies;

  public constructor(deps: HandlerDependencies) {
    super();
    this.deps = deps;
  }

  public async execute(query: GetHeadToHeadQuery): Promise<HeadToHead> {
    const found = await this.deps.matches.findMatch(query.matchId);

    if (found === undefined) throw new MatchNotFoundError(query.matchId);

    const { homeTeamId, awayTeamId } = found.fixture;
    // Result secrecy: the repository returns COMPLETED rows only, whose score columns hold the final score.
    const rows = await this.deps.matches.listMeetings({
      teamIds: [homeTeamId, awayTeamId],
      excludeMatchId: found.id,
      limit: HEAD_TO_HEAD_LIMIT,
    });
    const tally = { homeWins: 0, draws: 0, awayWins: 0 };
    const meetings: HeadToHead["meetings"] = [];

    for (const row of rows) {
      if (
        row.status !== "COMPLETED" ||
        row.homeScore === null ||
        row.awayScore === null
      )
        continue;

      const sameOrientation = row.fixture.homeTeamId === homeTeamId;
      const ours = sameOrientation ? row.homeScore : row.awayScore;
      const theirs = sameOrientation ? row.awayScore : row.homeScore;

      if (ours > theirs) tally.homeWins += 1;
      else if (ours < theirs) tally.awayWins += 1;
      else tally.draws += 1;

      meetings.push({
        matchId: asId<"MatchId">(row.id),
        leagueId: asId<"LeagueId">(row.fixture.leagueId),
        homeTeamId: asId<"TeamId">(row.fixture.homeTeamId),
        awayTeamId: asId<"TeamId">(row.fixture.awayTeamId),
        kickoffAt: row.fixture.kickoffAt.toISOString(),
        score: { home: row.homeScore, away: row.awayScore },
      });
    }

    return {
      matchId: asId<"MatchId">(found.id),
      played: meetings.length,
      ...tally,
      meetings,
    };
  }
}
