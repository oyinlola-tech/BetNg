import { describe, expect, it } from "vitest";
import { darkTheme, lightTheme, type ColorTheme } from "../src/index.js";

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r = 0, g = 0, b = 0] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi = 0, lo = 0] = [luminance(a), luminance(b)].sort((x, y) => y - x);

  return (hi + 0.05) / (lo + 0.05);
}

const SURFACES = ["background", "surface", "surfaceElevated", "surfaceSunken", "surfaceHover"] as const;
const TEXT = ["textPrimary", "textSecondary", "textMuted"] as const;
const STATUSES = ["success", "danger", "warning", "info", "pending", "void", "suspended"] as const;

describe.each([
  ["light", lightTheme],
  ["dark", darkTheme],
] as const)("%s theme contrast (WCAG AA)", (_name, theme: ColorTheme) => {
  it.each(TEXT.flatMap((text) => SURFACES.map((surface) => [text, surface] as const)))("%s on %s is at least 4.5:1", (text, surface) => {
    expect(contrast(theme[text], theme[surface])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(STATUSES)("%s text reads on its subtle background and on a surface", (status) => {
    expect(contrast(theme[status], theme[`${status}Subtle`])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme[status], theme.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme.textOnStatus, theme[status])).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps text on brand and on live fills readable, and brand links readable on surfaces", () => {
    expect(contrast(theme.textOnBrand, theme.brand)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme.textOnLive, theme.live)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme.brand, theme.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme.brand, theme.brandSubtle)).toBeGreaterThanOrEqual(4.5);
  });

  it("separates a control's border from the surface it sits on", () => {
    expect(contrast(theme.borderStrong, theme.surface)).toBeGreaterThanOrEqual(1.4);
    expect(contrast(theme.focusRing, theme.background)).toBeGreaterThanOrEqual(3);
  });
});
