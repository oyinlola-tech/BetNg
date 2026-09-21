import { QueryHandler } from "@zudojs/cqrs";
import { asId, ErrorCodes } from "@betng/contracts";
import type { MatchLineups, MatchSide } from "@betng/contracts";
import {
  LINEUPS,
  LIST_LIMIT,
  MATCH_QUERY,
} from "../../../../constants/index.js";
import {
  MatchNotFoundError,
  PeerFailedError,
} from "../../../../errors/index.js";
import type {
  MatchRecord,
  Squads,
  TeamSquad,
} from "../../../../interfaces/index.js";
import {
  createTtlCache,
  errorMessage,
  matchClockAt,
} from "../../../../utils/index.js";
import type { TtlCache } from "../../../../utils/index.js";
import type { HandlerDependencies } from "../../match.dependencies.js";
import type { GetMatchLineupsQuery } from "./getMatchLineups.query.js";

type TeamLineup = NonNullable<MatchLineups["home"]>;

function captainIndex(teamId: string, starters: number): number {
  if (starters <= 1) return 0;

  let sum = 0;

  for (const character of teamId) sum += character.charCodeAt(0);

  return 1 + (sum % (starters - 1));
}

function toLineup(
  squad: TeamSquad,
  teamId: string,
  side: MatchSide,
  substitutedAt: ReadonlyMap<string, number>,
): TeamLineup {
  const captain = captainIndex(teamId, squad.starting.length);

  return {
    teamId: asId<"TeamId">(teamId),
    side,
    formation: squad.formation,
    starting: squad.starting.map((player, index) => {
      const off = substitutedAt.get(`${side}:${player.name}`);

      return {
        ...player,
        ...(index === captain ? { captain: true } : {}),
        ...(off === undefined ? {} : { substitutedMinute: off }),
      };
    }),
    substitutes: squad.substitutes.map((player) => ({ ...player })),
  };
}

export class GetMatchLineupsHandler extends QueryHandler<
  GetMatchLineupsQuery,
  MatchLineups
> {
  public readonly queryType = MATCH_QUERY.GET_MATCH_LINEUPS;

  private readonly deps: HandlerDependencies;

  private readonly cache: TtlCache<Squads>;

  public constructor(deps: HandlerDependencies) {
    super();
    this.deps = deps;
    this.cache = createTtlCache<Squads>({
      ttlMs: LINEUPS.CACHE_TTL_MS,
      maxEntries: LINEUPS.CACHE_MAX_ENTRIES,
      now: () => deps.clock().getTime(),
    });
  }

  public async execute(query: GetMatchLineupsQuery): Promise<MatchLineups> {
    const found = await this.deps.matches.findMatch(query.matchId);

    if (found === undefined) throw new MatchNotFoundError(query.matchId);

    const squads = await this.squadsOf(found, query.requestId);
    const substitutedAt = await this.revealedSubstitutions(found);
    const { homeTeamId, awayTeamId, kickoffAt } = found.fixture;
    const clock = matchClockAt(
      {
        status: found.status,
        kickoffMs: kickoffAt.getTime(),
        everKickedOff: found.homeScore !== null,
      },
      this.deps.clock().getTime(),
      this.deps.timing,
    );

    return {
      matchId: asId<"MatchId">(found.id),
      confirmed: clock.period !== "PRE",
      home: toLineup(squads.home, homeTeamId, "HOME", substitutedAt),
      away: toLineup(squads.away, awayTeamId, "AWAY", substitutedAt),
    };
  }

  private async squadsOf(
    match: MatchRecord,
    requestId: string,
  ): Promise<Squads> {
    const { homeTeam, awayTeam } = match.fixture;

    try {
      return await this.cache.get(`${homeTeam.id}:${awayTeam.id}`, async () => {
        const squads = await this.deps.squads.getSquads(
          {
            home: { teamId: homeTeam.id, name: homeTeam.name },
            away: { teamId: awayTeam.id, name: awayTeam.name },
          },
          requestId,
        );

        if (
          squads.home.teamId.toLowerCase() !== homeTeam.id ||
          squads.away.teamId.toLowerCase() !== awayTeam.id
        )
          throw new Error("simulation.getSquads answered for other teams.");

        return squads;
      });
    } catch (error) {
      this.deps.logger.warn("Squads unavailable", {
        event: "match.squadsUnavailable",
        code: ErrorCodes.UPSTREAM_UNAVAILABLE,
        matchId: match.id,
        requestId,
        error: errorMessage(error),
      });

      throw new PeerFailedError(
        ErrorCodes.UPSTREAM_UNAVAILABLE,
        "Lineups are unavailable right now.",
      );
    }
  }

  /** Result secrecy: only substitutions at or below `revealed_sequence` are read, so none shows before its reveal. */
  private async revealedSubstitutions(
    match: MatchRecord,
  ): Promise<ReadonlyMap<string, number>> {
    const substitutedAt = new Map<string, number>();

    if (match.revealedSequence === 0) return substitutedAt;

    const events = await this.deps.simulation.listEvents(match.id, {
      after: 0,
      upTo: match.revealedSequence,
      limit: LIST_LIMIT.EVENTS_MAX,
    });

    for (const event of events) {
      if (
        event.type === "SUBSTITUTION" &&
        event.side !== null &&
        event.secondaryPlayer !== null
      )
        substitutedAt.set(
          `${event.side}:${event.secondaryPlayer}`,
          event.minute,
        );
    }

    return substitutedAt;
  }
}
