import type { FixtureId, MatchId, MatchLifecycle } from "@betng/contracts";
import type { Club, Competition } from "./clubs.js";
import { rng, uuidFrom } from "./prng.js";
import { FULL_TIME_SECONDS, VIRTUAL_TIMING } from "./timing.js";

export const CYCLE_SECONDS = 240;

export const SEASON_EPOCH_MS = Date.UTC(2026, 8, 20, 0, 0, 0);

export interface FixtureRef {
  readonly matchId: MatchId;
  readonly fixtureId: FixtureId;
  readonly competition: Competition;
  readonly round: number;
  readonly season: number;
  readonly matchday: number;
  readonly home: Club;
  readonly away: Club;
  readonly kickoffMs: number;
}

function pairings(
  competition: Competition,
  season: number,
): readonly (readonly [Club, Club])[][] {
  const order = rng(`season:${competition.seed.key}:${String(season)}`).shuffle(
    competition.clubs,
  );
  const n = order.length;
  const rounds: (readonly [Club, Club])[][] = [];
  const rotating = order.slice(1);

  for (let r = 0; r < n - 1; r += 1) {
    const round: (readonly [Club, Club])[] = [];
    const ring = [order[0] as Club, ...rotating];

    for (let i = 0; i < n / 2; i += 1) {
      const a = ring[i] as Club;
      const b = ring[n - 1 - i] as Club;

      // Alternate who is at home so no club plays six home games in a row.
      round.push(r % 2 === i % 2 ? [a, b] : [b, a]);
    }

    rounds.push(round);
    rotating.unshift(rotating.pop() as Club);
  }

  const reversed = rounds.map((round) =>
    round.map(([h, a]): readonly [Club, Club] => [a, h]),
  );

  return [...rounds, ...reversed];
}

const pairingCache = new Map<string, readonly (readonly [Club, Club])[][]>();

function seasonPairings(
  competition: Competition,
  season: number,
): readonly (readonly [Club, Club])[][] {
  const key = `${competition.seed.key}:${String(season)}`;
  let cached = pairingCache.get(key);

  if (cached === undefined) {
    cached = pairings(competition, season);
    pairingCache.set(key, cached);
  }

  return cached;
}

export function kickoffMs(competition: Competition, round: number): number {
  return (
    SEASON_EPOCH_MS +
    (competition.seed.offsetSeconds + round * CYCLE_SECONDS) * 1000
  );
}

export function fixturesForRound(
  competition: Competition,
  round: number,
): readonly FixtureRef[] {
  if (round < 0) return [];

  const season = Math.floor(round / competition.matchdays) + 1;
  const matchday = (round % competition.matchdays) + 1;
  const pairs = seasonPairings(competition, season)[matchday - 1] ?? [];
  const kickoff = kickoffMs(competition, round);

  return pairs.map(([home, away]): FixtureRef => {
    const key = `${competition.seed.key}:${String(round)}:${home.code}:${away.code}`;

    return {
      matchId: uuidFrom(`match:${key}`) as MatchId,
      fixtureId: uuidFrom(`fixture:${key}`) as FixtureId,
      competition,
      round,
      season,
      matchday,
      home,
      away,
      kickoffMs: kickoff,
    };
  });
}

export function roundFor(
  competition: Competition,
  season: number,
  matchday: number,
): number {
  return (season - 1) * competition.matchdays + (matchday - 1);
}

/** The round whose kick-off is the most recent at `now` (may be in play). */
export function currentRound(competition: Competition, now: number): number {
  return Math.floor((now - kickoffMs(competition, 0)) / (CYCLE_SECONDS * 1000));
}

export function bettingOpensMs(fixture: FixtureRef): number {
  return fixture.kickoffMs - CYCLE_SECONDS * 1000;
}

export function bettingClosesMs(fixture: FixtureRef): number {
  return fixture.kickoffMs - VIRTUAL_TIMING.bettingCloseLeadSeconds * 1000;
}

export function statusAt(
  fixture: FixtureRef,
  now: number,
): "SCHEDULED" | "BETTING_OPEN" | "BETTING_CLOSED" | "IN_PLAY" | "COMPLETED" {
  const seconds = (now - fixture.kickoffMs) / 1000;

  if (seconds < -CYCLE_SECONDS) return "SCHEDULED";
  if (seconds < -VIRTUAL_TIMING.bettingCloseLeadSeconds) return "BETTING_OPEN";
  if (seconds < 0) return "BETTING_CLOSED";
  if (seconds < FULL_TIME_SECONDS) return "IN_PLAY";
  return "COMPLETED";
}

export function fullTimeMs(fixture: FixtureRef): number {
  return fixture.kickoffMs + FULL_TIME_SECONDS * 1000;
}

export function settledMs(fixture: FixtureRef): number {
  return fullTimeMs(fixture) + VIRTUAL_TIMING.settlementDelaySeconds * 1000;
}

export function lifecycleAt(fixture: FixtureRef, now: number): MatchLifecycle {
  switch (statusAt(fixture, now)) {
    case "SCHEDULED":
      return "FIXTURE_CREATED";
    case "BETTING_OPEN":
      return "BETTING_OPEN";
    case "BETTING_CLOSED":
      return "BETTING_CLOSED";
    case "IN_PLAY":
      return now - fixture.kickoffMs < VIRTUAL_TIMING.secondsPerMinute * 1000
        ? "SIMULATION_STARTED"
        : "EVENTS_PUBLISHED";
    case "COMPLETED":
      return now < settledMs(fixture)
        ? "MATCH_FINISHED"
        : "SETTLEMENT_COMPLETED";
  }
}

export function findFixture(
  matchId: string,
  now: number,
  competitions: readonly Competition[],
): FixtureRef | undefined {
  for (const competition of competitions) {
    const centre = currentRound(competition, now);

    // Two seasons back covers every result a client can browse to.
    for (
      let round = centre + 2;
      round >= Math.max(0, centre - competition.matchdays * 2);
      round -= 1
    ) {
      const found = fixturesForRound(competition, round).find(
        (f) => f.matchId === matchId,
      );

      if (found !== undefined) return found;
    }
  }

  return undefined;
}
