/**
 * Leg evaluation: a pure function of the authoritative final score and the terms stored on the bet leg.
 *
 * Nothing here reads a price, a stake or a bettor. The same score and the same leg always give the same
 * outcome, which is what makes settlement reproducible from the database alone.
 */

export type LegOutcome = "WON" | "LOST" | "VOID";

export interface FinalScore {
  readonly homeGoals: number;
  readonly awayGoals: number;
}

export interface LegTerms {
  readonly marketType: string;
  readonly selectionCode: string;
  /** `betting.bet_selections.line` as text, e.g. "2.5"; null for markets without a line. */
  readonly line: string | null;
}

export interface LegEvaluation {
  readonly outcome: LegOutcome;
  /** False when the market or selection code is not one this service knows: the leg is void, stake back. */
  readonly recognised: boolean;
}

const CORRECT_SCORE_MAX_GOALS = 3;

const OVER_UNDER_CODE = /^(OVER|UNDER)_(\d{1,2})_5$/;
const CORRECT_SCORE_CODE = /^CS_(\d)_(\d)$/;

const UNRECOGNISED: LegEvaluation = Object.freeze({ outcome: "VOID", recognised: false });

function decided(won: boolean): LegEvaluation {
  return { outcome: won ? "WON" : "LOST", recognised: true };
}

function evaluateMatchResult(code: string, score: FinalScore): LegEvaluation {
  switch (code) {
    case "HOME":
      return decided(score.homeGoals > score.awayGoals);
    case "DRAW":
      return decided(score.homeGoals === score.awayGoals);
    case "AWAY":
      return decided(score.homeGoals < score.awayGoals);
    default:
      return UNRECOGNISED;
  }
}

function evaluateDoubleChance(code: string, score: FinalScore): LegEvaluation {
  switch (code) {
    case "HOME_DRAW":
      return decided(score.homeGoals >= score.awayGoals);
    case "HOME_AWAY":
      return decided(score.homeGoals !== score.awayGoals);
    case "DRAW_AWAY":
      return decided(score.homeGoals <= score.awayGoals);
    default:
      return UNRECOGNISED;
  }
}

/**
 * The line is read from the selection code (`OVER_2_5` → 2.5). A stored `line` that disagrees with the code
 * means the leg's terms are ambiguous, and an ambiguous leg is void rather than guessed.
 */
function evaluateOverUnder(terms: LegTerms, score: FinalScore): LegEvaluation {
  const match = OVER_UNDER_CODE.exec(terms.selectionCode);

  if (match === null) {
    return UNRECOGNISED;
  }

  const whole = Number(match[2]);

  if (terms.line !== null && Number(terms.line) !== whole + 0.5) {
    return UNRECOGNISED;
  }

  // Total goals are whole numbers, so "over x.5" is "more than x".
  const over = score.homeGoals + score.awayGoals > whole;

  return decided(match[1] === "OVER" ? over : !over);
}

function evaluateBothTeamsToScore(code: string, score: FinalScore): LegEvaluation {
  const both = score.homeGoals > 0 && score.awayGoals > 0;

  switch (code) {
    case "YES":
      return decided(both);
    case "NO":
      return decided(!both);
    default:
      return UNRECOGNISED;
  }
}

function evaluateGoalSpread(code: string, score: FinalScore): LegEvaluation {
  // Home −1.5 covers when the home side wins by two or more; away +1.5 is the complement.
  const homeCovers = score.homeGoals - score.awayGoals >= 2;

  switch (code) {
    case "HOME_MINUS_1_5":
      return decided(homeCovers);
    case "AWAY_PLUS_1_5":
      return decided(!homeCovers);
    default:
      return UNRECOGNISED;
  }
}

function evaluateCorrectScore(code: string, score: FinalScore): LegEvaluation {
  if (code === "CS_OTHER") {
    return decided(
      score.homeGoals > CORRECT_SCORE_MAX_GOALS || score.awayGoals > CORRECT_SCORE_MAX_GOALS,
    );
  }

  const match = CORRECT_SCORE_CODE.exec(code);

  if (match === null) {
    return UNRECOGNISED;
  }

  const home = Number(match[1]);
  const away = Number(match[2]);

  if (home > CORRECT_SCORE_MAX_GOALS || away > CORRECT_SCORE_MAX_GOALS) {
    return UNRECOGNISED;
  }

  return decided(score.homeGoals === home && score.awayGoals === away);
}

function isValidScore(score: FinalScore): boolean {
  return (
    Number.isInteger(score.homeGoals) &&
    Number.isInteger(score.awayGoals) &&
    score.homeGoals >= 0 &&
    score.awayGoals >= 0
  );
}

export function evaluateLeg(terms: LegTerms, score: FinalScore): LegEvaluation {
  if (!isValidScore(score)) {
    throw new RangeError("A final score is two non-negative whole numbers.");
  }

  switch (terms.marketType) {
    case "MATCH_RESULT":
      return evaluateMatchResult(terms.selectionCode, score);
    case "DOUBLE_CHANCE":
      return evaluateDoubleChance(terms.selectionCode, score);
    case "OVER_UNDER":
      return evaluateOverUnder(terms, score);
    case "BOTH_TEAMS_TO_SCORE":
      return evaluateBothTeamsToScore(terms.selectionCode, score);
    case "GOAL_SPREAD":
      return evaluateGoalSpread(terms.selectionCode, score);
    case "CORRECT_SCORE":
      return evaluateCorrectScore(terms.selectionCode, score);
    default:
      return UNRECOGNISED;
  }
}

/** The `result` string stored on a settled leg: "h-a". */
export function formatResult(score: FinalScore): string {
  return `${String(score.homeGoals)}-${String(score.awayGoals)}`;
}
