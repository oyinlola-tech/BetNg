import { describe, expect, it } from "vitest";
import { FOOTBALL_EVENT_ICON, FOOTBALL_ICONS, footballIconSvg, type FootballIconName } from "../src/index.js";

const names = Object.keys(FOOTBALL_ICONS) as FootballIconName[];

describe("football icons", () => {
  it("has the full set, each with geometry", () => {
    expect(names).toHaveLength(23);

    for (const name of names) expect(FOOTBALL_ICONS[name].length).toBeGreaterThan(0);
  });

  it("maps every reported event kind to an icon that exists", () => {
    for (const name of Object.values(FOOTBALL_EVENT_ICON)) expect(names).toContain(name);
  });

  it("renders a stroked 24-unit glyph with no text and no script", () => {
    for (const name of names) {
      const svg = footballIconSvg(name, { size: 32, color: "#fff" });

      expect(svg).toContain('viewBox="0 0 24 24"');
      expect(svg).toContain('stroke-linecap="round"');
      expect(svg).not.toMatch(/<text|<script|NaN|undefined/);
    }
  });

  it("paints a card only when given a card colour", () => {
    expect(footballIconSvg("yellowCard", { cardFill: "#F0B441" })).toContain('fill="#F0B441"');
    expect(footballIconSvg("yellowCard")).not.toContain("fill=\"#");
  });
});
