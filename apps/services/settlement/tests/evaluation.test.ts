import { describe, expect, it } from "vitest";
import { evaluateLeg, formatResult } from "../src/utils/index.js";
import type { LegOutcome } from "../src/utils/index.js";

type Row = readonly [market: string, code: string, home: number, away: number, expected: LegOutcome];

const TABLE: readonly Row[] = [
  ["MATCH_RESULT", "HOME", 2, 1, "WON"],
  ["MATCH_RESULT", "HOME", 1, 1, "LOST"],
  ["MATCH_RESULT", "HOME", 0, 1, "LOST"],
  ["MATCH_RESULT", "DRAW", 0, 0, "WON"],
  ["MATCH_RESULT", "DRAW", 3, 3, "WON"],
  ["MATCH_RESULT", "DRAW", 1, 0, "LOST"],
  ["MATCH_RESULT", "AWAY", 0, 1, "WON"],
  ["MATCH_RESULT", "AWAY", 0, 0, "LOST"],
  ["MATCH_RESULT", "AWAY", 4, 1, "LOST"],

  ["DOUBLE_CHANCE", "HOME_DRAW", 1, 0, "WON"],
  ["DOUBLE_CHANCE", "HOME_DRAW", 0, 0, "WON"],
  ["DOUBLE_CHANCE", "HOME_DRAW", 0, 1, "LOST"],
  ["DOUBLE_CHANCE", "HOME_AWAY", 1, 0, "WON"],
  ["DOUBLE_CHANCE", "HOME_AWAY", 0, 2, "WON"],
  ["DOUBLE_CHANCE", "HOME_AWAY", 2, 2, "LOST"],
  ["DOUBLE_CHANCE", "DRAW_AWAY", 1, 1, "WON"],
  ["DOUBLE_CHANCE", "DRAW_AWAY", 0, 3, "WON"],
  ["DOUBLE_CHANCE", "DRAW_AWAY", 1, 0, "LOST"],

  ["OVER_UNDER", "OVER_1_5", 1, 1, "WON"],
  ["OVER_UNDER", "OVER_1_5", 1, 0, "LOST"],
  ["OVER_UNDER", "UNDER_1_5", 1, 0, "WON"],
  ["OVER_UNDER", "UNDER_1_5", 0, 0, "WON"],
  ["OVER_UNDER", "UNDER_1_5", 2, 0, "LOST"],
  ["OVER_UNDER", "OVER_2_5", 2, 1, "WON"],
  ["OVER_UNDER", "OVER_2_5", 1, 1, "LOST"],
  ["OVER_UNDER", "OVER_2_5", 0, 0, "LOST"],
  ["OVER_UNDER", "UNDER_2_5", 1, 1, "WON"],
  ["OVER_UNDER", "UNDER_2_5", 2, 1, "LOST"],
  ["OVER_UNDER", "OVER_3_5", 4, 1, "WON"],
  ["OVER_UNDER", "OVER_3_5", 2, 1, "LOST"],
  ["OVER_UNDER", "UNDER_3_5", 2, 1, "WON"],
  ["OVER_UNDER", "UNDER_3_5", 2, 2, "LOST"],

  ["BOTH_TEAMS_TO_SCORE", "YES", 1, 1, "WON"],
  ["BOTH_TEAMS_TO_SCORE", "YES", 3, 0, "LOST"],
  ["BOTH_TEAMS_TO_SCORE", "YES", 0, 0, "LOST"],
  ["BOTH_TEAMS_TO_SCORE", "NO", 0, 0, "WON"],
  ["BOTH_TEAMS_TO_SCORE", "NO", 0, 2, "WON"],
  ["BOTH_TEAMS_TO_SCORE", "NO", 2, 1, "LOST"],

  ["GOAL_SPREAD", "HOME_MINUS_1_5", 2, 0, "WON"],
  ["GOAL_SPREAD", "HOME_MINUS_1_5", 4, 1, "WON"],
  ["GOAL_SPREAD", "HOME_MINUS_1_5", 1, 0, "LOST"],
  ["GOAL_SPREAD", "HOME_MINUS_1_5", 0, 0, "LOST"],
  ["GOAL_SPREAD", "AWAY_PLUS_1_5", 1, 0, "WON"],
  ["GOAL_SPREAD", "AWAY_PLUS_1_5", 0, 0, "WON"],
  ["GOAL_SPREAD", "AWAY_PLUS_1_5", 0, 3, "WON"],
  ["GOAL_SPREAD", "AWAY_PLUS_1_5", 2, 0, "LOST"],
  ["GOAL_SPREAD", "AWAY_PLUS_1_5", 3, 1, "LOST"],

  ["CORRECT_SCORE", "CS_0_0", 0, 0, "WON"],
  ["CORRECT_SCORE", "CS_0_0", 1, 0, "LOST"],
  ["CORRECT_SCORE", "CS_2_1", 2, 1, "WON"],
  ["CORRECT_SCORE", "CS_2_1", 1, 2, "LOST"],
  ["CORRECT_SCORE", "CS_3_3", 3, 3, "WON"],
  ["CORRECT_SCORE", "CS_3_1", 4, 1, "LOST"],
  ["CORRECT_SCORE", "CS_OTHER", 4, 1, "WON"],
  ["CORRECT_SCORE", "CS_OTHER", 0, 4, "WON"],
  ["CORRECT_SCORE", "CS_OTHER", 5, 5, "WON"],
  ["CORRECT_SCORE", "CS_OTHER", 3, 3, "LOST"],
  ["CORRECT_SCORE", "CS_OTHER", 0, 0, "LOST"],
];

describe("evaluateLeg", () => {
  it.each(TABLE)("%s %s at %i-%i is %s", (marketType, selectionCode, homeGoals, awayGoals, expected) => {
    expect(evaluateLeg({ marketType, selectionCode, line: null }, { homeGoals, awayGoals })).toEqual({
      outcome: expected,
      recognised: true,
    });
  });

  it("decides every one of the sixteen exact scores and nothing else for a 0..3 score", () => {
    for (let home = 0; home <= 3; home += 1) {
      for (let away = 0; away <= 3; away += 1) {
        const winners: string[] = [];

        for (let h = 0; h <= 3; h += 1) {
          for (let a = 0; a <= 3; a += 1) {
            const code = `CS_${String(h)}_${String(a)}`;
            const leg = { marketType: "CORRECT_SCORE", selectionCode: code, line: null };

            if (evaluateLeg(leg, { homeGoals: home, awayGoals: away }).outcome === "WON") {
              winners.push(code);
            }
          }
        }

        expect(winners).toEqual([`CS_${String(home)}_${String(away)}`]);
      }
    }
  });

  it("accepts the stored line when it agrees with the code and voids the leg when it does not", () => {
    const score = { homeGoals: 2, awayGoals: 1 };

    expect(evaluateLeg({ marketType: "OVER_UNDER", selectionCode: "OVER_2_5", line: "2.5" }, score)).toEqual({
      outcome: "WON",
      recognised: true,
    });
    expect(evaluateLeg({ marketType: "OVER_UNDER", selectionCode: "OVER_2_5", line: "3.5" }, score)).toEqual({
      outcome: "VOID",
      recognised: false,
    });
  });

  it.each([
    ["HALF_TIME_RESULT", "HOME"],
    ["MATCH_RESULT", "HOME_WIN"],
    ["DOUBLE_CHANCE", "HOME"],
    ["OVER_UNDER", "OVER_2"],
    ["OVER_UNDER", "OVER_2_0"],
    ["BOTH_TEAMS_TO_SCORE", "MAYBE"],
    ["GOAL_SPREAD", "HOME_MINUS_2_5"],
    ["CORRECT_SCORE", "CS_4_0"],
    ["CORRECT_SCORE", "CS_1"],
    ["CORRECT_SCORE", "cs_1_0"],
  ])("voids the unknown %s %s", (marketType, selectionCode) => {
    expect(evaluateLeg({ marketType, selectionCode, line: null }, { homeGoals: 1, awayGoals: 0 })).toEqual({
      outcome: "VOID",
      recognised: false,
    });
  });

  it("rejects a score that is not two non-negative whole numbers", () => {
    const leg = { marketType: "MATCH_RESULT", selectionCode: "HOME", line: null };

    expect(() => evaluateLeg(leg, { homeGoals: -1, awayGoals: 0 })).toThrow(RangeError);
    expect(() => evaluateLeg(leg, { homeGoals: 1.5, awayGoals: 0 })).toThrow(RangeError);
  });

  it("formats the result as h-a", () => {
    expect(formatResult({ homeGoals: 4, awayGoals: 1 })).toBe("4-1");
    expect(formatResult({ homeGoals: 0, awayGoals: 0 })).toBe("0-0");
  });
});
