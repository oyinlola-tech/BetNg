import { SettlementDataError } from "../errors/index.js";

export type LegOutcome = "WON" | "LOST" | "VOID";

export interface FinalScore {
  readonly homeGoals: number;
  readonly awayGoals: number;
}

export interface LegTerms {
  readonly marketType: string;
  readonly selectionCode: string;
  readonly line: string | null;
}

export interface LegEvaluation {
  readonly outcome: LegOutcome;
  /** False for an unknown market or selection code: the leg is void. */
  readonly recognised: boolean;
}

const CORRECT_SCORE_MAX_GOALS = 3;

const OVER_UNDER_CODE = /^(OVER|UNDER)_(\d{1,2})_5$/;
const CORRECT_SCORE_CODE = /^CS_(\d)_(\d)$/;
const LINE_TEXT = /^(\d{1,3})\.(\d)$/;

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

// NUMERIC(4,1) text only, read as integer tenths: "2,5", " 2.5" or "2.50" is corrupt data, never a guess.
function lineTenths(line: string): number {
  const match = LINE_TEXT.exec(line);

  if (match === null) {
    throw new SettlementDataError(`The stored line ${JSON.stringify(line.slice(0, 16))} is not a one-decimal number.`);
  }

  return Number(match[1]) * 10 + Number(match[2]);
}

// A well-formed stored line that disagrees with the code makes the leg ambiguous: void, never guessed.
function evaluateOverUnder(terms: LegTerms, score: FinalScore): LegEvaluation {
  const match = OVER_UNDER_CODE.exec(terms.selectionCode);

  if (match === null) {
    return UNRECOGNISED;
  }

  const whole = Number(match[2]);

  if (terms.line !== null && lineTenths(terms.line) !== whole * 10 + 5) {
    return UNRECOGNISED;
  }

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

export function formatResult(score: FinalScore): string {
  return `${String(score.homeGoals)}-${String(score.awayGoals)}`;
}
