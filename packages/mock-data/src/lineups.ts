import type {
  HeadToHeadMeeting,
  HeadToHeadView,
  LineupPlayer,
  MatchLineupsView,
  MatchSide,
  Player,
  TeamLineup,
} from "@betng/ui-core";
import type { Club } from "./clubs.js";
import { teamView } from "./engine.js";
import { rng } from "./prng.js";
import {
  currentRound,
  fixturesForRound,
  statusAt,
  type FixtureRef,
} from "./season.js";
import { releasedEvents, scriptFor } from "./simulate.js";

/** Every shape fields the same eleven the simulation starts: a keeper, four defenders, four midfielders, two forwards. */
const FORMATIONS: readonly (readonly number[])[] = [
  [4, 4, 2],
  [4, 4, 1, 1],
  [4, 1, 3, 2],
  [4, 2, 2, 2],
];

const STARTERS = 11;
const MEETINGS = 5;

function lineupPlayer(player: Player): LineupPlayer {
  return {
    id: player.id,
    name: player.name,
    shirt: player.shirt,
    position: player.position,
  };
}

function teamLineup(
  fixture: FixtureRef,
  side: MatchSide,
  substitutedAt: ReadonlyMap<string, number>,
): TeamLineup {
  const club: Club = side === "HOME" ? fixture.home : fixture.away;
  const r = rng(`lineup:${fixture.matchId}:${club.id}`);
  const shape = r.pick(FORMATIONS);
  const starters = club.squad.slice(0, STARTERS);
  const captain = r.pick(starters.slice(1)).id;
  const rows = [1, ...shape];
  let cursor = 0;

  const starting = rows.flatMap((size, rowIndex) =>
    Array.from({ length: size }, (_, slotIndex): LineupPlayer => {
      const player = starters[cursor] as Player;
      const off = substitutedAt.get(`${side}:${player.name}`);

      cursor += 1;

      return {
        ...lineupPlayer(player),
        ...(player.id === captain ? { captain: true } : {}),
        grid: { row: rowIndex + 1, slot: slotIndex + 1 },
        ...(off === undefined ? {} : { substitutedMinute: off }),
      };
    }),
  );

  return {
    teamId: club.id,
    side,
    formation: shape.join("-"),
    manager: club.manager,
    starting,
    substitutes: club.squad.slice(STARTERS).map(lineupPlayer),
  };
}

export function lineupsFor(fixture: FixtureRef, now: number): MatchLineupsView {
  const status = statusAt(fixture, now);
  const substitutedAt = new Map<string, number>();

  for (const event of releasedEvents(
    scriptFor(fixture),
    (now - fixture.kickoffMs) / 1000,
  )) {
    if (
      event.kind === "SUBSTITUTION" &&
      event.side !== undefined &&
      event.secondaryPlayer !== undefined
    ) {
      substitutedAt.set(`${event.side}:${event.secondaryPlayer}`, event.minute);
    }
  }

  return {
    matchId: fixture.matchId,
    confirmed: status !== "SCHEDULED" && status !== "BETTING_OPEN",
    home: teamLineup(fixture, "HOME", substitutedAt),
    away: teamLineup(fixture, "AWAY", substitutedAt),
  };
}

export function headToHeadFor(fixture: FixtureRef, now: number): HeadToHeadView {
  const { competition, home, away } = fixture;
  // No further back than a client can open a match from.
  const oldest = Math.max(
    0,
    currentRound(competition, now) - competition.matchdays * 2,
  );
  const meetings: HeadToHeadMeeting[] = [];
  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;

  for (
    let round = fixture.round - 1;
    round >= oldest && meetings.length < MEETINGS;
    round -= 1
  ) {
    const earlier = fixturesForRound(competition, round).find(
      (f) =>
        (f.home.id === home.id && f.away.id === away.id) ||
        (f.home.id === away.id && f.away.id === home.id),
    );

    if (earlier === undefined || statusAt(earlier, now) !== "COMPLETED") continue;

    const score = scriptFor(earlier).finalScore;
    const ours = earlier.home.id === home.id ? score.home : score.away;
    const theirs = earlier.home.id === home.id ? score.away : score.home;

    if (ours > theirs) homeWins += 1;
    else if (ours < theirs) awayWins += 1;
    else draws += 1;

    meetings.push({
      matchId: earlier.matchId,
      kickoffAt: new Date(earlier.kickoffMs).toISOString(),
      leagueCode: competition.seed.code,
      home: teamView(earlier.home),
      away: teamView(earlier.away),
      score,
    });
  }

  return {
    matchId: fixture.matchId,
    played: meetings.length,
    homeWins,
    draws,
    awayWins,
    meetings,
  };
}
