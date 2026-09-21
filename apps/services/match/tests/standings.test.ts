import { describe, expect, it } from "vitest";
import { computeStandings } from "../src/utils/index.js";

const at = (day: number): Date => new Date(Date.UTC(2026, 0, day));

describe("standings", () => {
  const rows = computeStandings(
    ["A", "B", "C", "D"],
    [
      {
        homeTeamId: "A",
        awayTeamId: "B",
        homeGoals: 2,
        awayGoals: 0,
        completedAt: at(1),
      },
      {
        homeTeamId: "C",
        awayTeamId: "A",
        homeGoals: 1,
        awayGoals: 1,
        completedAt: at(2),
      },
      {
        homeTeamId: "B",
        awayTeamId: "C",
        homeGoals: 3,
        awayGoals: 1,
        completedAt: at(3),
      },
      {
        homeTeamId: "A",
        awayTeamId: "C",
        homeGoals: 0,
        awayGoals: 1,
        completedAt: at(4),
      },
    ],
  );
  const row = (teamId: string) => rows.find((entry) => entry.teamId === teamId);

  it("awards three points for a win and one for a draw", () => {
    expect(row("A")).toMatchObject({
      played: 3,
      won: 1,
      drawn: 1,
      lost: 1,
      goalsFor: 3,
      goalsAgainst: 2,
      goalDifference: 1,
      points: 4,
    });
    expect(row("B")).toMatchObject({
      played: 2,
      won: 1,
      drawn: 0,
      lost: 1,
      goalsFor: 3,
      goalsAgainst: 3,
      goalDifference: 0,
      points: 3,
    });
    expect(row("C")).toMatchObject({
      played: 3,
      won: 1,
      drawn: 1,
      lost: 1,
      goalsFor: 3,
      goalsAgainst: 4,
      goalDifference: -1,
      points: 4,
    });
    expect(row("D")).toMatchObject({ played: 0, points: 0, form: [] });
  });

  it("orders by points, then goal difference, then goals scored", () => {
    expect(rows.map((entry) => entry.teamId)).toEqual(["A", "C", "B", "D"]);
    expect(rows.map((entry) => entry.position)).toEqual([1, 2, 3, 4]);
  });

  it("lists form oldest first and keeps the last five", () => {
    expect(row("A")?.form).toEqual(["W", "D", "L"]);
    expect(row("C")?.form).toEqual(["D", "L", "W"]);

    const long = computeStandings(
      ["X", "Y"],
      Array.from({ length: 7 }, (_, index) => ({
        homeTeamId: "X",
        awayTeamId: "Y",
        homeGoals: index < 2 ? 0 : 1,
        awayGoals: index < 2 ? 1 : 0,
        completedAt: at(index + 1),
      })),
    );

    expect(long.find((entry) => entry.teamId === "X")?.form).toEqual([
      "W",
      "W",
      "W",
      "W",
      "W",
    ]);
    expect(long.find((entry) => entry.teamId === "Y")?.points).toBe(6);
  });
});
