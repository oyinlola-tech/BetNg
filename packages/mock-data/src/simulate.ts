/** Plays a virtual match. */

import type { MatchId } from "@betng/contracts";
import {
  FIRST_HALF_SECONDS,
  FULL_TIME_SECONDS,
  SECOND_HALF_START_SECONDS,
  VIRTUAL_TIMING,
  type MatchEventKind,
  type MatchSide,
  type MatchStats,
  type Player,
  type Score,
  type SideStats,
} from "@betng/ui-core";
import type { Club } from "./clubs.js";
import { rng, uuidFrom, type Rng } from "./prng.js";
import type { FixtureRef } from "./season.js";

export interface ScriptEvent {
  readonly id: string;
  readonly kind: MatchEventKind;
  readonly minute: number;
  readonly side?: MatchSide;
  readonly player?: string;
  readonly secondaryPlayer?: string;
  readonly description: string;
  readonly score: Score;
  /** Real seconds after kick-off at which the event is released. */
  readonly releaseSeconds: number;
}

type TickKind = "SHOT" | "SHOT_ON_TARGET" | "FOUL" | "OFFSIDE";

interface StatTick {
  readonly minute: number;
  readonly side: MatchSide;
  readonly kind: TickKind;
}

export interface MatchScript {
  readonly events: readonly ScriptEvent[];
  readonly ticks: readonly StatTick[];
  readonly possessionHome: number;
  readonly finalScore: Score;
}

export function expectedGoals(
  home: Club,
  away: Club,
): { readonly home: number; readonly away: number } {
  const diff = (home.strength - away.strength) / 40;
  const clamp = (x: number): number => Math.min(3.4, Math.max(0.35, x));

  return {
    home: clamp(1.32 * Math.exp(diff * 0.9) * 1.08),
    away: clamp(1.12 * Math.exp(-diff * 0.9)),
  };
}

function pickByPosition(
  r: Rng,
  squad: readonly Player[],
  weights: Record<Player["position"], number>,
): Player {
  const pool = squad.flatMap((p) =>
    Array.from({ length: weights[p.position] }, () => p),
  );

  return r.pick(pool);
}

const SCORER_WEIGHTS: Record<Player["position"], number> = {
  GK: 0,
  DF: 1,
  MF: 3,
  FW: 7,
};
const BOOKED_WEIGHTS: Record<Player["position"], number> = {
  GK: 1,
  DF: 5,
  MF: 4,
  FW: 2,
};
const SUB_OFF_WEIGHTS: Record<Player["position"], number> = {
  GK: 0,
  DF: 2,
  MF: 4,
  FW: 4,
};

/** Minutes a normal event may fall on: never on the half-time boundary. */
function eventMinute(r: Rng, half: 1 | 2 | undefined = undefined): number {
  const h = half ?? (r.chance(0.5) ? 1 : 2);

  return h === 1 ? r.int(1, 44) : r.int(46, 89);
}

function releaseFor(r: Rng, minute: number): number {
  const spm = VIRTUAL_TIMING.secondsPerMinute;
  const jitter = r.next() * spm * 0.85;

  return minute <= 45
    ? minute * spm + jitter
    : SECOND_HALF_START_SECONDS + (minute - 45) * spm + jitter;
}

const scriptCache = new Map<string, MatchScript>();

export function scriptFor(fixture: FixtureRef): MatchScript {
  const cached = scriptCache.get(fixture.matchId);

  if (cached !== undefined) return cached;

  const r = rng(`script:${fixture.matchId}`);
  const { home, away } = fixture;
  const xg = expectedGoals(home, away);

  interface Draft {
    kind: MatchEventKind;
    minute: number;
    side?: MatchSide;
    player?: string;
    secondaryPlayer?: string;
    release: number;
  }

  const drafts: Draft[] = [];
  const clubFor = (side: MatchSide): Club => (side === "HOME" ? home : away);

  for (const side of ["HOME", "AWAY"] as const) {
    const goals = r.poisson(side === "HOME" ? xg.home : xg.away);
    const squad = clubFor(side).squad;

    for (let i = 0; i < goals; i += 1) {
      const scorer = pickByPosition(r, squad, SCORER_WEIGHTS);
      const assist = r.chance(0.7)
        ? pickByPosition(
            r,
            squad.filter((p) => p.id !== scorer.id),
            SCORER_WEIGHTS,
          )
        : undefined;
      const minute = eventMinute(r);

      drafts.push({
        kind: "GOAL",
        minute,
        side,
        player: scorer.name,
        ...(assist === undefined ? {} : { secondaryPlayer: assist.name }),
        release: releaseFor(r, minute),
      });
    }
  }

  for (const side of ["HOME", "AWAY"] as const) {
    const squad = clubFor(side).squad;
    const yellows = r.poisson(1.5);
    const booked = new Set<string>();

    for (let i = 0; i < yellows; i += 1) {
      const player = pickByPosition(r, squad, BOOKED_WEIGHTS);

      if (booked.has(player.id)) continue;

      booked.add(player.id);

      const minute = eventMinute(r);

      drafts.push({
        kind: "YELLOW_CARD",
        minute,
        side,
        player: player.name,
        release: releaseFor(r, minute),
      });
    }

    if (r.chance(0.06)) {
      const player = pickByPosition(r, squad, BOOKED_WEIGHTS);
      const minute = r.int(50, 88);

      drafts.push({
        kind: "RED_CARD",
        minute,
        side,
        player: player.name,
        release: releaseFor(r, minute),
      });
    }
  }

  /* Substitutions: between two and three a side, second half. */
  for (const side of ["HOME", "AWAY"] as const) {
    const squad = clubFor(side).squad;
    const starters = squad.slice(0, 11);
    const bench = squad.slice(11);
    const count = r.int(2, 3);
    const used = new Set<string>();

    for (let i = 0; i < count && i < bench.length; i += 1) {
      const off = pickByPosition(
        r,
        starters.filter((p) => !used.has(p.id)),
        SUB_OFF_WEIGHTS,
      );
      const on = bench[i] as Player;

      used.add(off.id);

      const minute = r.int(55, 86);

      drafts.push({
        kind: "SUBSTITUTION",
        minute,
        side,
        player: on.name,
        secondaryPlayer: off.name,
        release: releaseFor(r, minute),
      });
    }
  }

  for (const side of ["HOME", "AWAY"] as const) {
    const corners = r.poisson(side === "HOME" ? 5 : 4);

    for (let i = 0; i < corners; i += 1) {
      const minute = eventMinute(r);

      drafts.push({
        kind: "CORNER",
        minute,
        side,
        release: releaseFor(r, minute),
      });
    }
  }

  drafts.push({ kind: "KICK_OFF", minute: 0, release: 0 });
  drafts.push({ kind: "HALF_TIME", minute: 45, release: FIRST_HALF_SECONDS });
  drafts.push({
    kind: "SECOND_HALF",
    minute: 45,
    release: SECOND_HALF_START_SECONDS,
  });
  drafts.push({ kind: "FULL_TIME", minute: 90, release: FULL_TIME_SECONDS });

  drafts.sort((a, b) => a.release - b.release);

  /* Hidden statistics ticks. */
  const ticks: StatTick[] = [];
  const goalsFor = (side: MatchSide): number =>
    drafts.filter((d) => d.kind === "GOAL" && d.side === side).length;

  for (const side of ["HOME", "AWAY"] as const) {
    const lambda = side === "HOME" ? xg.home : xg.away;
    const goals = goalsFor(side);
    const shots = goals + r.poisson(6.5 * (lambda / 1.3) + 2);
    const onTarget =
      goals + Math.round((shots - goals) * (0.28 + r.next() * 0.16));

    for (let i = 0; i < shots; i += 1) {
      ticks.push({
        minute: eventMinute(r),
        side,
        kind: i < onTarget ? "SHOT_ON_TARGET" : "SHOT",
      });
    }

    const fouls = r.poisson(9);

    for (let i = 0; i < fouls; i += 1)
      ticks.push({ minute: eventMinute(r), side, kind: "FOUL" });

    const offsides = r.poisson(1.8);

    for (let i = 0; i < offsides; i += 1)
      ticks.push({ minute: eventMinute(r), side, kind: "OFFSIDE" });
  }

  ticks.sort((a, b) => a.minute - b.minute);

  let score: Score = { home: 0, away: 0 };
  const scoreline = (): string =>
    `${home.name} ${String(score.home)}–${String(score.away)} ${away.name}`;

  const events = drafts.map((d, index): ScriptEvent => {
    const team = d.side === undefined ? undefined : clubFor(d.side);

    if (d.kind === "GOAL") {
      score =
        d.side === "HOME"
          ? { ...score, home: score.home + 1 }
          : { ...score, away: score.away + 1 };
    }

    let description: string;

    switch (d.kind) {
      case "KICK_OFF":
        description = `Kick-off at ${home.stadium}`;
        break;
      case "GOAL":
        description = `${d.player ?? "Goal"} scores for ${team?.name ?? ""}${
          d.secondaryPlayer === undefined
            ? ""
            : `, assisted by ${d.secondaryPlayer}`
        }`;
        break;
      case "YELLOW_CARD":
        description = `${d.player ?? ""} (${team?.shortName ?? ""}) is booked`;
        break;
      case "RED_CARD":
        description = `${d.player ?? ""} (${team?.shortName ?? ""}) is sent off`;
        break;
      case "SUBSTITUTION":
        description = `${team?.shortName ?? ""}: ${d.player ?? ""} replaces ${d.secondaryPlayer ?? ""}`;
        break;
      case "CORNER":
        description = `Corner to ${team?.name ?? ""}`;
        break;
      case "HALF_TIME":
        description = `Half time: ${scoreline()}`;
        break;
      case "SECOND_HALF":
        description = "Second half under way";
        break;
      case "FULL_TIME":
        description = `Full time: ${scoreline()}`;
        break;
      case "SHOT":
        description = "Shot";
        break;
    }

    return {
      id: uuidFrom(`event:${fixture.matchId}:${String(index)}`),
      kind: d.kind,
      minute: d.minute,
      ...(d.side === undefined ? {} : { side: d.side }),
      ...(d.player === undefined ? {} : { player: d.player }),
      ...(d.secondaryPlayer === undefined
        ? {}
        : { secondaryPlayer: d.secondaryPlayer }),
      description,
      score,
      releaseSeconds: d.release,
    };
  });

  const possessionHome = Math.round(
    Math.min(
      68,
      Math.max(
        32,
        50 + ((home.strength - away.strength) / 40) * 11 + (r.next() - 0.5) * 6,
      ),
    ),
  );

  const script: MatchScript = {
    events,
    ticks,
    possessionHome,
    finalScore: score,
  };

  scriptCache.set(fixture.matchId, script);

  return script;
}

export function releasedEvents(
  script: MatchScript,
  elapsedSeconds: number,
): readonly ScriptEvent[] {
  if (elapsedSeconds < 0) return [];

  let count = 0;

  for (const e of script.events) {
    if (e.releaseSeconds <= elapsedSeconds) count += 1;
    else break;
  }

  return script.events.slice(0, count);
}

export function statsAt(
  script: MatchScript,
  released: readonly ScriptEvent[],
  minute: number,
  matchId: MatchId,
): MatchStats {
  const side = (which: MatchSide): SideStats => {
    const ticks = script.ticks.filter(
      (t) => t.side === which && t.minute <= minute,
    );
    const events = released.filter((e) => e.side === which);
    const onTarget = ticks.filter((t) => t.kind === "SHOT_ON_TARGET").length;
    const shots = onTarget + ticks.filter((t) => t.kind === "SHOT").length;

    // Possession drifts toward the match's tendency over the first quarter
    // and wobbles a little thereafter, so the bar moves like a real one.
    const ramp = Math.min(1, minute / 20);
    const wobble = Math.sin(minute * 0.7 + which.length) * 2.5;
    const home = 50 + (script.possessionHome - 50) * ramp + wobble;
    const possession =
      minute === 0 ? 50 : Math.round(which === "HOME" ? home : 100 - home);

    return {
      possession,
      shots,
      shotsOnTarget: onTarget,
      corners: events.filter((e) => e.kind === "CORNER").length,
      fouls: ticks.filter((t) => t.kind === "FOUL").length,
      offsides: ticks.filter((t) => t.kind === "OFFSIDE").length,
      yellowCards: events.filter((e) => e.kind === "YELLOW_CARD").length,
      redCards: events.filter((e) => e.kind === "RED_CARD").length,
    };
  };

  void matchId;

  return { home: side("HOME"), away: side("AWAY") };
}
