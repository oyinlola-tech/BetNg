import type { StateTone } from "@betng/design-tokens";
import type { MatchStatus } from "@betng/contracts";
import type { ClockPeriod, MatchPhase } from "./types/index.js";

export interface PhaseSignals {
  readonly lifecycle?: string | undefined;
  readonly period?: ClockPeriod | undefined;
}

const SETTLED_LIFECYCLES = new Set(["SETTLEMENT_COMPLETED"]);
const VOID_LIFECYCLES = new Set(["VOIDED"]);
const HELD_LIFECYCLES = new Set(["SIMULATION_FAILED"]);

/** The presentation phase, from platform state only: the status, the lifecycle and the reported clock period. Time is never an input. */
export function resolvePhase(
  status: MatchStatus | "POSTPONED" | "SUSPENDED" | "DELAYED",
  signals: PhaseSignals = {},
): MatchPhase {
  if (signals.lifecycle !== undefined) {
    if (VOID_LIFECYCLES.has(signals.lifecycle)) return "CANCELLED";
    if (HELD_LIFECYCLES.has(signals.lifecycle)) return "SUSPENDED";
  }

  switch (status) {
    case "SCHEDULED":
    case "BETTING_OPEN":
    case "BETTING_CLOSED":
    case "CANCELLED":
    case "POSTPONED":
    case "SUSPENDED":
    case "DELAYED":
      return status;
    case "IN_PLAY":
      if (signals.period === "HALF_TIME") return "HALFTIME";
      if (signals.period === "FULL_TIME") return "FINISHED";
      return "LIVE";
    case "COMPLETED":
      return signals.lifecycle !== undefined &&
        SETTLED_LIFECYCLES.has(signals.lifecycle)
        ? "SETTLED"
        : "FINISHED";
  }
}

export function isInPlay(phase: MatchPhase): boolean {
  return phase === "LIVE" || phase === "HALFTIME";
}

export function isFinished(phase: MatchPhase): boolean {
  return phase === "FINISHED" || phase === "SETTLED";
}

export function isUpcoming(phase: MatchPhase): boolean {
  return (
    phase === "SCHEDULED" ||
    phase === "BETTING_OPEN" ||
    phase === "BETTING_CLOSED" ||
    phase === "DELAYED"
  );
}

export function isInterrupted(phase: MatchPhase): boolean {
  return (
    phase === "POSTPONED" || phase === "SUSPENDED" || phase === "CANCELLED"
  );
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
    case "POSTPONED":
    case "DELAYED":
    case "SUSPENDED":
      return "warning";
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
    case "POSTPONED":
      return "PPD";
    case "DELAYED":
      return "DELAYED";
    case "SUSPENDED":
      return "SUSP";
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
    case "POSTPONED":
      return "Postponed";
    case "DELAYED":
      return "Kick-off delayed";
    case "SUSPENDED":
      return "Suspended";
  }
}

export function isBettable(phase: MatchPhase): boolean {
  return canBet(phase);
}

export function isClosed(phase: MatchPhase): boolean {
  return phase === "BETTING_CLOSED";
}

/** Closed to new bets and waiting on kick-off: the transition the lobby calls "starting soon". */
export function isStarting(phase: MatchPhase): boolean {
  return phase === "BETTING_CLOSED" || phase === "DELAYED";
}

export function isHalfTime(phase: MatchPhase): boolean {
  return phase === "HALFTIME";
}

export function isSettled(phase: MatchPhase): boolean {
  return phase === "SETTLED";
}
