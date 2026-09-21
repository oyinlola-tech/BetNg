import type { LeagueId, MatchId, TeamId } from "@betng/contracts";
import {
  DataSourceError,
  MAX_SELECTIONS,
  STAKE_LIMITS,
  computeStandings,
  toLocalDateKey,
  type BetNgDataSource,
  type LeagueView,
  type MatchFilter,
  type MatchSummary,
  type SearchHit,
  type SearchKind,
  type TopScorer,
} from "@betng/ui-core";
import {
  COMPETITIONS,
  clubById,
  competitionById,
  type Competition,
} from "./clubs.js";
import { MockPlatform, teamView, type MockPlatformOptions } from "./engine.js";
import { headToHeadFor, lineupsFor } from "./lineups.js";
import { marketsFor } from "./markets.js";
import {
  CYCLE_SECONDS,
  currentRound,
  fixturesForRound,
  kickoffMs,
  roundFor,
  statusAt,
  type FixtureRef,
} from "./season.js";
import { scriptFor } from "./simulate.js";

export interface MockDataSource extends BetNgDataSource {
  readonly platform: MockPlatform;
}

function leagueView(competition: Competition, now: number): LeagueView {
  const round = Math.max(0, currentRound(competition, now));

  return {
    id: competition.id,
    name: competition.seed.name,
    code: competition.seed.code,
    slug: competition.seed.slug,
    sport: "football",
    status: "ACTIVE",
    country: competition.seed.country,
    teamCount: competition.clubs.length,
    matchdays: competition.matchdays,
    currentSeason: Math.floor(round / competition.matchdays) + 1,
    currentMatchday: (round % competition.matchdays) + 1,
    cycleSeconds: CYCLE_SECONDS,
  };
}

const SEARCH_KINDS: readonly SearchKind[] = ["LEAGUE", "TEAM", "MATCH"];
const SEARCH_LIMIT = 20;
const SEARCH_LIMIT_MAX = 50;

function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function seasonRounds(
  competition: Competition,
  season: number,
  now: number,
): number[] {
  const first = roundFor(competition, season, 1);
  const last = Math.min(
    first + competition.matchdays - 1,
    currentRound(competition, now),
  );
  const rounds: number[] = [];

  for (let r = first; r <= last; r += 1) rounds.push(r);

  return rounds;
}

export function createMockDataSource(
  options: MockPlatformOptions = {},
): MockDataSource {
  const platform = new MockPlatform(options);
  const now = platform.now;

  const competitionsFor = (leagueId?: string): readonly Competition[] =>
    leagueId === undefined
      ? COMPETITIONS
      : COMPETITIONS.filter((c) => c.id === leagueId);

  function completedThisSeason(
    competition: Competition,
    season: number,
  ): readonly MatchSummary[] {
    const t = now();

    return seasonRounds(competition, season, t)
      .flatMap((round) => fixturesForRound(competition, round))
      .filter((f) => statusAt(f, t) === "COMPLETED")
      .map((f) => platform.summary(f, t));
  }

  function requireFixture(matchId: string): FixtureRef {
    const fixture = platform.fixture(matchId);

    if (fixture === undefined)
      throw new DataSourceError("NOT_FOUND", "That match is not available.");

    return fixture;
  }

  function candidates(filter: MatchFilter): readonly FixtureRef[] {
    const t = now();
    const out: FixtureRef[] = [];

    for (const competition of competitionsFor(filter.leagueId)) {
      const current = currentRound(competition, t);

      if (filter.season !== undefined && filter.matchday !== undefined) {
        out.push(
          ...fixturesForRound(
            competition,
            roundFor(competition, filter.season, filter.matchday),
          ),
        );
        continue;
      }

      if (filter.date !== undefined) {
        for (let round = current + 2; round >= 0; round -= 1) {
          const key = toLocalDateKey(new Date(kickoffMs(competition, round)));

          if (key > filter.date) continue;
          if (key < filter.date) break;

          out.push(...fixturesForRound(competition, round));
        }
        continue;
      }

      if (filter.matchday !== undefined) {
        const season =
          Math.floor(Math.max(0, current) / competition.matchdays) + 1;

        out.push(
          ...fixturesForRound(
            competition,
            roundFor(competition, season, filter.matchday),
          ),
        );
        continue;
      }

      const wantsFinished =
        filter.phases?.some((p) => p === "FINISHED" || p === "SETTLED") ?? true;
      const back = wantsFinished ? 4 : 1;

      for (let round = current - back; round <= current + 2; round += 1) {
        out.push(...fixturesForRound(competition, round));
      }
    }

    return out;
  }

  function searchHits(
    needle: string,
    kinds: readonly SearchKind[],
  ): readonly SearchHit[] {
    const t = now();
    const hits: { readonly hit: SearchHit; readonly rank: number }[] = [];
    const offer = (hit: SearchHit, ...fields: readonly string[]): void => {
      const folded = fields.map(fold);

      if (!folded.some((f) => f.includes(needle))) return;

      hits.push({
        hit,
        rank:
          SEARCH_KINDS.indexOf(hit.kind) * 2 +
          (folded.some((f) => f.startsWith(needle)) ? 0 : 1),
      });
    };

    for (const competition of COMPETITIONS) {
      const { seed } = competition;

      if (kinds.includes("LEAGUE")) {
        offer(
          {
            kind: "LEAGUE",
            id: competition.id,
            title: seed.name,
            subtitle: seed.country,
            leagueId: competition.id,
          },
          seed.name,
          seed.code,
          seed.country,
        );
      }

      if (kinds.includes("TEAM")) {
        for (const club of competition.clubs) {
          offer(
            {
              kind: "TEAM",
              id: club.id,
              title: club.name,
              subtitle: seed.name,
              teamId: club.id,
              leagueId: competition.id,
            },
            club.name,
            club.shortName,
            club.code,
            club.city,
          );
        }
      }

      if (kinds.includes("MATCH")) {
        const current = currentRound(competition, t);

        for (let round = current - 1; round <= current + 2; round += 1) {
          for (const f of fixturesForRound(competition, round)) {
            offer(
              {
                kind: "MATCH",
                id: f.matchId,
                title: `${f.home.name} v ${f.away.name}`,
                subtitle: `${seed.code} · Matchday ${String(f.matchday)}`,
                matchId: f.matchId,
                leagueId: competition.id,
              },
              f.home.name,
              f.away.name,
              f.home.shortName,
              f.away.shortName,
              `${f.home.name} v ${f.away.name}`,
              `${f.home.code} ${f.away.code}`,
            );
          }
        }
      }
    }

    return hits.sort((a, b) => a.rank - b.rank).map((h) => h.hit);
  }

  const source: MockDataSource = {
    platform,

    /** @endpoint GET /api/v1/leagues → { items: League[] } */
    listLeagues: async () => {
      await platform.delay();

      return COMPETITIONS.map((c) => leagueView(c, now()));
    },

    getLeague: async (leagueId) => {
      await platform.delay();

      const competition = competitionById(leagueId);

      if (competition === undefined)
        throw new DataSourceError("NOT_FOUND", "That league is not available.");

      return leagueView(competition, now());
    },

    /** @endpoint GET /api/v1/teams?leagueId= → { items: Team[] } */
    listTeams: async (leagueId?: LeagueId) => {
      await platform.delay();

      return competitionsFor(leagueId).flatMap((c) => c.clubs.map(teamView));
    },

    getTeam: async (teamId: TeamId) => {
      await platform.delay();

      const club = clubById(teamId);

      if (club === undefined)
        throw new DataSourceError("NOT_FOUND", "That team is not available.");

      return club;
    },

    /** @endpoint GET /api/v1/leagues/:id/standings?season= → Standings */
    getStandings: async (leagueId, season) => {
      await platform.delay();

      const competition = competitionById(leagueId);

      if (competition === undefined)
        throw new DataSourceError("NOT_FOUND", "That league is not available.");

      const league = leagueView(competition, now());
      const s = season ?? league.currentSeason;

      return computeStandings(
        leagueId,
        s,
        competition.clubs.map(teamView),
        completedThisSeason(competition, s),
      );
    },

    /** @endpoint GET /api/v1/leagues/:id/scorers?season= → { items: TopScorer[] } */
    getTopScorers: async (leagueId, season) => {
      await platform.delay();

      const competition = competitionById(leagueId);

      if (competition === undefined) return [];

      const s = season ?? leagueView(competition, now()).currentSeason;
      const tally = new Map<string, TopScorer>();

      for (const round of seasonRounds(competition, s, now())) {
        for (const fixture of fixturesForRound(competition, round)) {
          if (statusAt(fixture, now()) !== "COMPLETED") continue;

          for (const event of scriptFor(fixture).events) {
            if (
              (event.kind !== "GOAL" && event.kind !== "PENALTY_GOAL") ||
              event.player === undefined
            )
              continue;

            const club = event.side === "HOME" ? fixture.home : fixture.away;
            const key = `${club.id}:${event.player}`;
            const entry = tally.get(key) ?? {
              player: event.player,
              team: teamView(club),
              goals: 0,
              assists: 0,
            };

            tally.set(key, { ...entry, goals: entry.goals + 1 });

            if (event.secondaryPlayer !== undefined) {
              const aKey = `${club.id}:${event.secondaryPlayer}`;
              const a = tally.get(aKey) ?? {
                player: event.secondaryPlayer,
                team: teamView(club),
                goals: 0,
                assists: 0,
              };

              tally.set(aKey, { ...a, assists: a.assists + 1 });
            }
          }
        }
      }

      return [...tally.values()]
        .sort(
          (a, b) =>
            b.goals - a.goals ||
            b.assists - a.assists ||
            a.player.localeCompare(b.player),
        )
        .slice(0, 10);
    },

    /** @endpoint GET /api/v1/matches?leagueId=&status= → { items: Match[] } */
    listMatches: async (filter: MatchFilter = {}) => {
      await platform.delay();

      const t = now();
      const { phases, teamId } = filter;

      const list = candidates(filter)
        .filter(
          (f) =>
            teamId === undefined ||
            f.home.id === teamId ||
            f.away.id === teamId,
        )
        .map((f) => platform.summary(f, t))
        .filter((m) => phases === undefined || phases.includes(m.phase));

      const finishedOnly =
        phases !== undefined &&
        phases.every((p) => p === "FINISHED" || p === "SETTLED");

      list.sort((a, b) =>
        finishedOnly
          ? b.kickoffAt.localeCompare(a.kickoffAt)
          : a.kickoffAt.localeCompare(b.kickoffAt),
      );

      return list.slice(0, filter.limit ?? Number.POSITIVE_INFINITY);
    },

    getMatch: async (matchId: MatchId) => {
      await platform.delay();

      return platform.view(requireFixture(matchId));
    },

    getMatchMarkets: async (matchId: MatchId) => {
      await platform.delay();

      return marketsFor(requireFixture(matchId), now());
    },

    /** @endpoint GET /api/v1/matches/:id/lineups → MatchLineups */
    getMatchLineups: async (matchId: MatchId) => {
      await platform.delay();

      return lineupsFor(requireFixture(matchId), now());
    },

    /** @endpoint GET /api/v1/matches/:id/head-to-head → HeadToHead */
    getHeadToHead: async (matchId: MatchId) => {
      await platform.delay();

      return headToHeadFor(requireFixture(matchId), now());
    },

    /** @endpoint GET /api/v1/search?q= → { term, hits: SearchHit[] } */
    search: async (query) => {
      await platform.delay();

      const term = query.term.trim();
      const limit = Math.min(
        SEARCH_LIMIT_MAX,
        Math.max(1, Math.trunc(query.limit ?? SEARCH_LIMIT)),
      );

      if (term.length < 2) return { term, hits: [] };

      return {
        term,
        hits: searchHits(fold(term), query.kinds ?? SEARCH_KINDS).slice(
          0,
          limit,
        ),
      };
    },

    /** @endpoint GET /api/v1/config → PlatformConfig */
    getPlatformConfig: async () => {
      await platform.delay();

      return {
        currency: { code: "NGN", symbol: "₦", minorUnits: 2, locale: "en-NG" },
        features: {
          virtualFootballEnabled: true,
          walletEnabled: true,
          shopEnabled: true,
          adminEnabled: true,
          liveEnabled: true,
          tvEnabled: true,
          searchEnabled: true,
          paymentsEnabled: true,
          kycEnabled: true,
          responsibleGamingEnabled: true,
          twoFactorEnabled: true,
          accountSessionsEnabled: true,
          statementsEnabled: true,
          notificationChannelsEnabled: true,
          accountDeletionEnabled: true,
          cashShiftsEnabled: true,
          complianceEnabled: true,
        },
        stakeLimits: {
          min: STAKE_LIMITS.min,
          max: STAKE_LIMITS.max,
          maxSelections: MAX_SELECTIONS,
        },
        competitionTimezone: "Africa/Lagos",
        maintenance: false,
      };
    },

    listCompletedMatchdays: async (leagueId, season) => {
      await platform.delay();

      const competition = competitionById(leagueId);

      if (competition === undefined) return [];

      const s = season ?? leagueView(competition, now()).currentSeason;

      return seasonRounds(competition, s, now())
        .filter((round) =>
          fixturesForRound(competition, round).every(
            (f) => statusAt(f, now()) === "COMPLETED",
          ),
        )
        .map((round) => (round % competition.matchdays) + 1)
        .reverse();
    },

    subscribeMatch: (matchId, handlers) => {
      const fixture = platform.fixture(matchId);
      const offConnection = platform.onConnection(handlers.onConnection);

      handlers.onConnection(platform.getConnection());

      const stop =
        fixture === undefined
          ? (): void => undefined
          : platform.stream(fixture, handlers);

      return {
        unsubscribe: () => {
          stop();
          offConnection();
        },
      };
    },

    subscribeConnection: (listener) => platform.onConnection(listener),
    getConnectionState: () => platform.getConnection(),

    getWallet: async () => {
      await platform.delay();

      return platform.wallet();
    },
    listTransactions: async () => {
      await platform.delay();

      return platform.transactions();
    },
    queryTransactions: async (query) => {
      await platform.delay();

      return platform.queryTransactions(query);
    },
    deposit: async (amount) => {
      await platform.delay();

      return platform.deposit(amount);
    },
    withdraw: async (amount) => {
      await platform.delay();

      return platform.withdraw(amount);
    },
    placeBet: async (input) => {
      await platform.delay();

      return platform.placeBet(input);
    },
    listBets: async () => {
      await platform.delay();

      return platform.bets();
    },
    getBet: async (betId) => {
      await platform.delay();

      const bet = platform.bet(betId);

      if (bet === undefined)
        throw new DataSourceError("NOT_FOUND", "That bet is not available.");

      return bet;
    },
    listNotifications: async () => {
      await platform.delay();

      return platform.notifications();
    },
    markNotificationsRead: async (ids) => {
      await platform.delay();
      platform.markRead(ids);
    },
    getNotificationPreferences: () => Promise.resolve(platform.preferences()),
    setNotificationPreferences: (preferences) => {
      platform.setPreferences(preferences);

      return Promise.resolve();
    },
    listViewedMatches: async () => {
      await platform.delay();

      const t = now();

      return platform
        .viewed()
        .slice(0, 10)
        .flatMap((id) => {
          const fixture = platform.fixture(id);

          return fixture === undefined ? [] : [platform.summary(fixture, t)];
        });
    },
    recordView: (matchId) => {
      platform.recordView(matchId);
    },
    subscribeAccount: (listener) => platform.onAccount(listener),
  };

  return source;
}
