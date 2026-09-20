import type { StateTone } from "@betng/design-tokens";
import type { MatchStatus } from "@betng/contracts";
import { matchClock, FULL_TIME_SECONDS, VIRTUAL_TIMING } from "./timing.js";
import type { MatchPhase } from "./types/index.js";

/**
 * Derives the presentation phase.
 *
 * The contract status is authoritative for the betting window and the
 * outcome; the clock refines `IN_PLAY` into live or half-time and
 * `COMPLETED` into finished or settled.
 */
export function derivePhase(
  status: MatchStatus,
  kickoffAt: string,
  now: number,
): MatchPhase {
  switch (status) {
    case "SCHEDULED":
      return "SCHEDULED";
    case "BETTING_OPEN":
      return "BETTING_OPEN";
    case "BETTING_CLOSED":
      return "BETTING_CLOSED";
    case "CANCELLED":
      return "CANCELLED";
    case "IN_PLAY": {
      const clock = matchClock(kickoffAt, now);

      if (clock.period === "HALF_TIME") return "HALFTIME";
      if (clock.period === "FULL_TIME") return "FINISHED";
      return "LIVE";
    }
    case "COMPLETED": {
      const elapsed = (now - Date.parse(kickoffAt)) / 1000;

      return elapsed >= FULL_TIME_SECONDS + VIRTUAL_TIMING.settlementDelaySeconds
        ? "SETTLED"
        : "FINISHED";
    }
  }
}

export function isInPlay(phase: MatchPhase): boolean {
  return phase === "LIVE" || phase === "HALFTIME";
}

export function isFinished(phase: MatchPhase): boolean {
  return phase === "FINISHED" || phase === "SETTLED";
}

export function isUpcoming(phase: MatchPhase): boolean {
  return phase === "SCHEDULED" || phase === "BETTING_OPEN" || phase === "BETTING_CLOSED";
}

export function canBet(phase: MatchPhase): boolean {
  return phase === "BETTING_OPEN";
}

export function phaseTone(phase: MatchPhase): StateTone {
  switch (phase) {
    case "LIVE":
      return "live";
    case "HALFTIME":
      return "live";
    case "BETTING_OPEN":
      return "brand";
    case "BETTING_CLOSED":
      return "warning";
    case "SCHEDULED":
      return "neutral";
    case "FINISHED":
      return "muted";
    case "SETTLED":
      return "muted";
    case "CANCELLED":
      return "muted";
  }
}

export function phaseLabel(phase: MatchPhase): string {
  switch (phase) {
    case "LIVE":
      return "LIVE";
    case "HALFTIME":
      return "HT";
    case "BETTING_OPEN":
      return "BETTING";
    case "BETTING_CLOSED":
      return "CLOSED";
    case "SCHEDULED":
      return "UPCOMING";
    case "FINISHED":
      return "FT";
    case "SETTLED":
      return "FT";
    case "CANCELLED":
      return "OFF";
  }
}

export function phaseDescription(phase: MatchPhase): string {
  switch (phase) {
    case "LIVE":
      return "In play";
    case "HALFTIME":
      return "Half time";
    case "BETTING_OPEN":
      return "Betting open";
    case "BETTING_CLOSED":
      return "Betting closed · kicking off";
    case "SCHEDULED":
      return "Scheduled";
    case "FINISHED":
      return "Full time · settling";
    case "SETTLED":
      return "Full time";
    case "CANCELLED":
      return "Cancelled";
  }
}
