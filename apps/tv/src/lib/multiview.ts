import type { MatchSummary, Score } from "@betng/ui-core";

export type Side = "HOME" | "AWAY" | "BOTH";

export function scoringSide(previous: Score | undefined, next: Score): Side | undefined {
  if (previous === undefined) return undefined;

  const home = next.home > previous.home;
  const away = next.away > previous.away;

  if (home && away) return "BOTH";
  if (home) return "HOME";
  if (away) return "AWAY";

  return undefined;
}

export function detectGoals(previous: ReadonlyMap<string, Score>, next: readonly { readonly id: string; readonly score: Score }[]): readonly string[] {
  return next.filter((m) => scoringSide(previous.get(m.id), m.score) !== undefined).map((m) => m.id);
}

export interface AutoSwitchConfig {
  readonly enabled: boolean;
  readonly cooldownMs: number;
  readonly holdMs: number;
}

export interface AutoSwitchState {
  readonly focusId: string | undefined;
  readonly since: number;
  readonly lastSwitchAt: number | undefined;
}

export const IDLE_SWITCH: AutoSwitchState = { focusId: undefined, since: 0, lastSwitchAt: undefined };

/* A goal takes its match full screen; another goal inside the cooldown does not move it, so the view never thrashes. */
export function decideAutoSwitch(state: AutoSwitchState, goals: readonly string[], now: number, config: AutoSwitchConfig): AutoSwitchState {
  let next = state;

  if (next.focusId !== undefined && now - next.since >= config.holdMs) next = { ...next, focusId: undefined };

  const coolingDown = next.lastSwitchAt !== undefined && now - next.lastSwitchAt < config.cooldownMs;

  if (!config.enabled || goals.length === 0 || coolingDown) return next;

  const target = [...goals].sort()[0];

  return target === undefined ? next : { focusId: target, since: now, lastSwitchAt: now };
}

export function orderForSplit(matches: readonly MatchSummary[], favourites: ReadonlySet<string>): readonly MatchSummary[] {
  const followed = (m: MatchSummary): number => (favourites.has(m.home.id) || favourites.has(m.away.id) ? 0 : 1);

  return [...matches].sort((a, b) => followed(a) - followed(b) || a.kickoffAt.localeCompare(b.kickoffAt) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
