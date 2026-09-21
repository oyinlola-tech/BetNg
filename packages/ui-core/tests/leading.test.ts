import { describe, expect, it } from "vitest";
import { leadingSelections } from "../src/leading.js";
import type { MatchMarketsView } from "../src/types/index.js";

const market = (kind: string, selections: Record<string, number>, line?: number) => ({ kind, line, selections: Object.entries(selections).map(([code, odds]) => ({ code, odds })) });

const markets = {
  markets: [
    market("MATCH_RESULT", { HOME: 1.47, DRAW: 4.24, AWAY: 6.49 }),
    market("DOUBLE_CHANCE", { HOME_DRAW: 1.11, HOME_AWAY: 1.2, DRAW_AWAY: 2.71 }),
    market("OVER_UNDER", { OVER_1_5: 1.24, UNDER_1_5: 4.11 }, 1.5),
    market("OVER_UNDER", { OVER_2_5: 1.91, UNDER_2_5: 2.43 }, 2.5),
    market("OVER_UNDER", { OVER_3_5: 3.4, UNDER_3_5: 1.32 }, 3.5),
    market("BOTH_TEAMS_TO_SCORE", { YES: 1.99, NO: 2.14 }),
    market("CORRECT_SCORE", { CS_2_0: 8.46, CS_0_0: 16.8, CS_OTHER: 21.1 }),
  ],
} as unknown as MatchMarketsView;

const board = (home: number, away: number): Record<string, string> => Object.fromEntries(leadingSelections(markets, { home, away }).map((c) => [c.key, `${c.label} ${String(c.odds ?? "-")}`]));

describe("leadingSelections", () => {
  it("reads a 2-0 home lead the way a shop board prints it", () => {
    expect(board(2, 0)).toEqual({ "1x2": "1 1.47", cs: "2-0 8.46", dc: "1X 1.11", ou1_5: "OV 1.5 1.24", ou2_5: "UN 2.5 2.43", ou3_5: "UN 3.5 1.32", btts: "NG 2.14" });
  });

  it("reads a goalless draw", () => {
    expect(board(0, 0)).toMatchObject({ "1x2": "X 4.24", cs: "0-0 16.8", dc: "1X 1.11", ou1_5: "UN 1.5 4.11", btts: "NG 2.14" });
  });

  it("flips totals and both-teams-to-score as goals go in", () => {
    expect(board(2, 1)).toMatchObject({ ou2_5: "OV 2.5 1.91", btts: "GG 1.99" });
  });

  it("falls back to Other for a score outside the correct-score grid, and to the away double chance", () => {
    expect(board(1, 5)).toMatchObject({ "1x2": "2 6.49", cs: "Other 21.1", dc: "12 1.2" });
  });

  it("still names the outcome when prices have not loaded", () => {
    expect(leadingSelections(undefined, { home: 1, away: 0 }).map((c) => [c.label, c.odds])).toContainEqual(["1", undefined]);
  });
});
