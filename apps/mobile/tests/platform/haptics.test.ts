import { describe, expect, it } from "vitest";
import { createHaptics, hapticPattern, type VibrationPattern } from "../../src/platform/haptics";

describe("haptics", () => {
  it("uses a short buzz for accepted and a distinct pattern for rejected", () => {
    expect(hapticPattern("bet-accepted")).toBe(40);
    expect(hapticPattern("bet-rejected")).toEqual([0, 60, 90, 60]);
  });

  it("respects the setting and never throws", () => {
    const played: VibrationPattern[] = [];
    let enabled = true;
    const haptics = createHaptics((p) => played.push(p), () => enabled);

    haptics.play("bet-accepted");
    enabled = false;
    haptics.play("bet-rejected");

    expect(played).toEqual([40]);
    expect(() => {
      createHaptics(() => {
        throw new Error("no motor");
      }, () => true).play("bet-rejected");
    }).not.toThrow();
  });
});
