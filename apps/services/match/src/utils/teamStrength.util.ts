/**
 * Team ratings.
 *
 * A seeded club carries one overall `strength`; the simulation wants nine attributes. They are derived from the
 * strength with a small spread keyed by the team code, so two clubs of equal strength still differ in style and
 * the same club always gets the same profile.
 */

import { createHash } from "node:crypto";
import type { TeamRatings, TeamStrength } from "@betng/contracts";

export interface TeamRatingColumns {
  readonly strength: number;
  readonly attack: number;
  readonly defence: number;
  readonly midfield: number;
  readonly goalkeeping: number;
  readonly pace: number;
  readonly finishing: number;
  readonly possession: number;
  readonly form: number;
  readonly homeAdvantage: number;
}

export const DEFAULT_HOME_ADVANTAGE = 55;

const SPREAD = 6;
const FORM_SPREAD = 3;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** A whole number in `[-spread, +spread]`, fixed for a given team code and attribute. */
function offset(code: string, attribute: string, spread: number): number {
  const digest = createHash("sha256").update(`${code}:${attribute}`).digest();

  return (digest.readUInt16BE(0) % (spread * 2 + 1)) - spread;
}

export function deriveRatings(strength: number, code: string): TeamRatingColumns {
  const rated = (attribute: string): number => clamp(Math.round(strength) + offset(code, attribute, SPREAD), 1, 99);

  return {
    strength: clamp(Math.round(strength), 0, 100),
    attack: rated("attack"),
    defence: rated("defence"),
    midfield: rated("midfield"),
    goalkeeping: rated("goalkeeping"),
    pace: rated("pace"),
    finishing: rated("finishing"),
    possession: rated("possession"),
    form: offset(code, "form", FORM_SPREAD),
    homeAdvantage: DEFAULT_HOME_ADVANTAGE,
  };
}

/** The overall strength shown for a team whose ratings an admin set: the mean of its six playing attributes. */
export function overallStrength(ratings: Omit<TeamRatings, "form">): number {
  const total =
    ratings.attack + ratings.midfield + ratings.defence + ratings.goalkeeper + ratings.pace + ratings.finishing;

  return clamp(Math.round(total / 6), 0, 100);
}

export function toTeamStrength(team: TeamRatingColumns): TeamStrength {
  return {
    attack: team.attack,
    defence: team.defence,
    midfield: team.midfield,
    goalkeeping: team.goalkeeping,
    pace: team.pace,
    finishing: team.finishing,
    possession: team.possession,
    form: team.form,
    homeAdvantage: team.homeAdvantage,
  };
}
