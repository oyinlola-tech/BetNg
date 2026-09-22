import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Score } from "@betng/ui-core";
import { createFakePlatform, match, reduceMotion, resultMarket } from "../fakes/platform";

const fake = vi.hoisted((): { source: unknown } => ({ source: undefined }));

vi.mock("../../src/services/dataSource", () => ({
  get dataSource() {
    return fake.source;
  },
}));

const { AnimatedScore } = await import("../../src/components/AnimatedScore");
const { GoalFlash } = await import("../../src/components/GoalFlash");
const { OddsTicker } = await import("../../src/components/OddsTicker");
const { useGoalFlash } = await import("../../src/hooks/useGoalFlash");
const { reads } = await import("../../src/lib/reads");

const m = match("flash");

function Harness({ score }: { readonly score: Score }): React.JSX.Element {
  const flash = useGoalFlash(m.id, score);

  return (
    <div>
      <GoalFlash flash={flash} home={m.home} away={m.away} score={score} />
    </div>
  );
}

let restore: () => void = () => undefined;

beforeEach(() => {
  reads.clear();
});

afterEach(() => {
  restore();
  vi.useRealTimers();
});

describe("TV score transitions", () => {
  it("counts up and rolls the digit with full motion", () => {
    vi.useFakeTimers();
    restore = reduceMotion(false);

    const { container, rerender } = render(<AnimatedScore value={0} />);

    rerender(<AnimatedScore value={2} />);
    expect(container.textContent).toBe("0");
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(container.textContent).toBe("1");
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(container.textContent).toBe("2");
    expect(container.querySelector(".animate-score-roll")).not.toBeNull();
  });

  it("jumps straight to the platform score under reduced motion", () => {
    restore = reduceMotion(true);

    const { container, rerender } = render(<AnimatedScore value={0} />);

    rerender(<AnimatedScore value={3} />);
    expect(container.textContent).toBe("3");
    expect(container.querySelector(".animate-score-roll")).toBeNull();
    expect(container.querySelector("[data-motion='reduced']")).not.toBeNull();
  });

  it("flashes for three seconds when either side scores, never on the first score seen", () => {
    vi.useFakeTimers();
    restore = reduceMotion(false);

    const { rerender } = render(<Harness score={{ home: 1, away: 0 }} />);

    expect(screen.queryByRole("status")).toBeNull();
    rerender(<Harness score={{ home: 1, away: 1 }} />);

    const flash = screen.getByRole("status");

    expect(flash).toHaveTextContent("Goal");
    expect(flash).toHaveTextContent(m.away.name);
    expect(flash.getAttribute("data-side")).toBe("AWAY");
    expect(flash.querySelector(".animate-goal-flash")).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(screen.queryByRole("status")).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows the goal flash without animation under reduced motion", () => {
    restore = reduceMotion(true);

    const { rerender } = render(<Harness score={{ home: 0, away: 0 }} />);

    rerender(<Harness score={{ home: 1, away: 0 }} />);

    const flash = screen.getByRole("status");

    expect(flash.getAttribute("data-motion")).toBe("reduced");
    expect(flash.querySelector(".animate-goal-flash, .animate-goal-in, .animate-fade-in")).toBeNull();
  });
});

describe("TV odds ticker motion", () => {
  function platform(): void {
    const { state, source } = createFakePlatform();

    state.matches = [match("t1", { phase: "BETTING_OPEN", status: "BETTING_OPEN" })];
    state.markets.set("t1", resultMarket("t1", [2, 3.2, 3.6]));
    fake.source = source;
  }

  it("scrolls with full motion and offers nothing to select", async () => {
    platform();
    restore = reduceMotion(false);

    const { container } = render(<OddsTicker />);
    const region = await screen.findByRole("region", { name: "Current prices, display only" });

    expect(region.getAttribute("data-motion")).toBe("full");
    expect(container.querySelector(".ticker-track")).not.toBeNull();
    expect(region).toHaveTextContent("implied 50.0%");
    expect(container.querySelector("button, a, [data-tv-focusable], [tabindex]")).toBeNull();
  });

  it("stops scrolling under reduced motion", async () => {
    platform();
    restore = reduceMotion(true);

    const { container } = render(<OddsTicker />);
    const region = await screen.findByRole("region", { name: "Current prices, display only" });

    expect(region.getAttribute("data-motion")).toBe("reduced");
    expect(container.querySelector(".ticker-track")).toBeNull();
    expect(region).toHaveTextContent("3.20");
  });
});
