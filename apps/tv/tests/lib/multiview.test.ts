import { describe, expect, it } from "vitest";
import type { MatchSummary } from "@betng/ui-core";
import { decideAutoSwitch, detectGoals, IDLE_SWITCH, orderForSplit, scoringSide } from "../../src/lib/multiview";
import { match } from "../fakes/platform";

const config = { enabled: true, cooldownMs: 60_000, holdMs: 15_000 };

describe("TV multi-match view", () => {
  it("recognises a goal for either side from the platform score only", () => {
    expect(scoringSide(undefined, { home: 1, away: 0 })).toBeUndefined();
    expect(scoringSide({ home: 0, away: 0 }, { home: 0, away: 1 })).toBe("AWAY");
    expect(scoringSide({ home: 0, away: 0 }, { home: 1, away: 1 })).toBe("BOTH");
    expect(scoringSide({ home: 2, away: 0 }, { home: 1, away: 0 })).toBeUndefined();
    expect(detectGoals(new Map([["a", { home: 0, away: 0 }]]), [{ id: "a", score: { home: 1, away: 0 } }, { id: "b", score: { home: 3, away: 0 } }])).toEqual(["a"]);
  });

  it("goes full screen on a goal, holds, then returns", () => {
    let s = decideAutoSwitch(IDLE_SWITCH, ["m1"], 1000, config);

    expect(s.focusId).toBe("m1");
    s = decideAutoSwitch(s, [], 1000 + 14_000, config);
    expect(s.focusId).toBe("m1");
    s = decideAutoSwitch(s, [], 1000 + 15_000, config);
    expect(s.focusId).toBeUndefined();
  });

  it("does not thrash: a goal inside the cooldown is ignored", () => {
    let s = decideAutoSwitch(IDLE_SWITCH, ["m1"], 0, config);

    s = decideAutoSwitch(s, ["m2"], 5000, config);
    expect(s.focusId).toBe("m1");
    s = decideAutoSwitch(s, ["m2"], 30_000, config);
    expect(s.focusId).toBeUndefined();
    s = decideAutoSwitch(s, ["m2"], 60_000, config);
    expect(s.focusId).toBe("m2");
  });

  it("stays put when switched off", () => {
    expect(decideAutoSwitch(IDLE_SWITCH, ["m1"], 0, { ...config, enabled: false }).focusId).toBeUndefined();
  });

  it("puts followed teams' matches first in the split", () => {
    const strip = (id: string, kickoffAt: string): MatchSummary => {
      const { events: _e, stats: _s, ...rest } = match(id, { kickoffAt });

      return rest;
    };
    const list = [strip("x", "2026-09-22T12:00:00.000Z"), strip("y", "2026-09-22T12:10:00.000Z"), strip("z", "2026-09-22T11:50:00.000Z")];

    expect(orderForSplit(list, new Set()).map((m) => m.id)).toEqual(["z", "x", "y"]);
    expect(orderForSplit(list, new Set(["y-a"])).map((m) => m.id)).toEqual(["y", "z", "x"]);
  });
});
