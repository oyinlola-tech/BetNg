import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FootballIcon, iconForEvent } from "../../src/components/FootballIcon";

describe("TV football icons", () => {
  it("maps every timeline event to an icon and falls back for unknown kinds", () => {
    expect(iconForEvent("GOAL")).toBe("goal");
    expect(iconForEvent("RED_CARD")).toBe("redCard");
    expect(iconForEvent("SECOND_HALF")).toBe("kickoff");
    expect(iconForEvent("SOMETHING_NEW" as never)).toBe("whistle");
  });

  it("fills a card with its status colour and leaves other glyphs stroked", () => {
    const red = render(<FootballIcon name="redCard" />).container;
    const goal = render(<FootballIcon name="goal" />).container;

    expect(red.querySelector("rect")?.getAttribute("fill")).toBe("var(--bn-danger)");
    expect(goal.querySelector("svg")?.getAttribute("fill")).toBe("none");
    expect(goal.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });
});
