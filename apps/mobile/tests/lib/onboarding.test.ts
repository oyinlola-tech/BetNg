import { describe, expect, it } from "vitest";
import { ONBOARDING_PAGES, pageForOffset } from "../../src/lib/onboarding";

describe("onboarding", () => {
  it("has two or three pages, each with its own key and words", () => {
    expect(ONBOARDING_PAGES.length).toBeGreaterThanOrEqual(2);
    expect(ONBOARDING_PAGES.length).toBeLessThanOrEqual(3);
    expect(new Set(ONBOARDING_PAGES.map((page) => page.key)).size).toBe(ONBOARDING_PAGES.length);

    for (const page of ONBOARDING_PAGES) {
      expect(page.eyebrow).not.toBe("");
      expect(page.title).not.toBe("");
      expect(page.body).not.toBe("");
    }
  });

  it("settles on the page nearest the scroll offset", () => {
    expect(pageForOffset(0, 390, 3)).toBe(0);
    expect(pageForOffset(390, 390, 3)).toBe(1);
    expect(pageForOffset(780, 390, 3)).toBe(2);
    expect(pageForOffset(180, 390, 3)).toBe(0);
    expect(pageForOffset(200, 390, 3)).toBe(1);
  });

  it("never leaves the pages, whatever the pager reports", () => {
    expect(pageForOffset(-120, 390, 3)).toBe(0);
    expect(pageForOffset(5000, 390, 3)).toBe(2);
    expect(pageForOffset(390, 0, 3)).toBe(0);
    expect(pageForOffset(Number.NaN, 390, 3)).toBe(0);
    expect(pageForOffset(390, 390, 0)).toBe(0);
  });
});
