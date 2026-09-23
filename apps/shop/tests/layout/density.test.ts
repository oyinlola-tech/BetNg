import { describe, expect, it } from "vitest";
import { densityFor } from "../../src/hooks/useTerminalDensity";

/*
 * The density is chosen from the viewport the browser actually reports, not
 * from a screen size: two 12-inch terminals can report very different
 * resolutions, and browser zoom changes the answer again on one machine.
 */
describe("terminal density", () => {
  it("keeps full density on a normal counter monitor", () => {
    expect(densityFor(1920, 1080)).toBe("NORMAL");
    expect(densityFor(2560, 1440)).toBe("NORMAL");
    expect(densityFor(1440, 900)).toBe("NORMAL");
  });

  it("compacts the common laptop terminal", () => {
    expect(densityFor(1366, 768)).toBe("COMPACT");
    expect(densityFor(1280, 800)).toBe("COMPACT");
  });

  it("goes ultra compact on a short netbook viewport", () => {
    expect(densityFor(1024, 600)).toBe("ULTRA_COMPACT");
  });

  it("compacts on width even when the display is tall", () => {
    // A narrow viewport loses the three-column layout before it loses height.
    expect(densityFor(1100, 1400)).toBe("COMPACT");
  });

  it("treats height as the stronger signal", () => {
    // A wide but short viewport is still the harder case to lay out.
    expect(densityFor(2560, 640)).toBe("ULTRA_COMPACT");
  });

  it("is stable across the boundaries rather than flickering", () => {
    expect(densityFor(1920, 681)).toBe("COMPACT");
    expect(densityFor(1920, 680)).toBe("ULTRA_COMPACT");
    expect(densityFor(1920, 821)).toBe("NORMAL");
    expect(densityFor(1920, 820)).toBe("COMPACT");
  });
});
