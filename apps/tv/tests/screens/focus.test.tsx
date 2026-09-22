import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router";
import type { MatchEventView } from "@betng/ui-core";
import { createFakePlatform, event, league, match, stubLayout, team, type FakePlatform } from "../fakes/platform";

const fake = vi.hoisted((): { source: unknown } => ({ source: undefined }));

vi.mock("../../src/services/dataSource", () => ({
  get dataSource() {
    return fake.source;
  },
}));

const { MultiScreen } = await import("../../src/screens/MultiScreen");
const { FeedScreen } = await import("../../src/screens/FeedScreen");
const { SettingsScreen } = await import("../../src/screens/SettingsScreen");
const { ReplayScreen } = await import("../../src/screens/ReplayScreen");
const { ScheduleOverlay } = await import("../../src/components/ScheduleOverlay");
const { installFocusKeeper, installRemote } = await import("../../src/navigation/spatial");
const { reads } = await import("../../src/lib/reads");
const { reloadSettings, updateSettings } = await import("../../src/lib/displaySettings");

let state: FakePlatform;
let cleanups: (() => void)[] = [];

function mount(path: string, routes: { readonly path: string; readonly Component: () => React.JSX.Element | null }[]): void {
  const router = createMemoryRouter([...routes, { path: "*", Component: () => <a data-tv-focusable="" href="/elsewhere">elsewhere</a> }], { initialEntries: [path] });

  render(<RouterProvider router={router} />);
  cleanups.push(installFocusKeeper({ settleMs: 50, path: () => router.state.location.pathname }));
}

function focused(): HTMLElement {
  const active = document.activeElement;

  if (!(active instanceof HTMLElement) || !active.matches("[data-tv-focusable]") || !active.isConnected) throw new Error(`focus lost: ${String(active?.outerHTML.slice(0, 80))}`);

  return active;
}

function goal(matchId: string, sequence: number, score: { home: number; away: number }): MatchEventView {
  return { ...event("GOAL", 60, score), id: `live-${matchId}-${String(sequence)}`, matchId: matchId as MatchEventView["matchId"], sequence, occurredAt: new Date().toISOString() };
}

beforeEach(() => {
  localStorage.clear();
  reloadSettings();
  reads.clear();
  const platform = createFakePlatform();

  state = platform.state;
  fake.source = platform.source;
  cleanups.push(stubLayout());
});

afterEach(() => {
  for (const c of cleanups.reverse()) c();
  cleanups = [];
  vi.useRealTimers();
});

describe("TV focus in the new views", () => {
  it("Multi-match keeps focus through a goal going full screen and coming back", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    state.matches = [match("mv1", { kickoffAt: "2026-09-22T12:00:00.000Z" }), match("mv2", { kickoffAt: "2026-09-22T12:01:00.000Z" })];
    mount("/multi?view=2", [{ path: "/multi", Component: MultiScreen }]);

    await waitFor(() => {
      expect(focused()).toHaveTextContent("2 up");
    });
    await waitFor(() => {
      expect(state.handlers.has("mv2")).toBe(true);
    });

    const tile = document.querySelector<HTMLElement>("[data-tile='mv1']");

    tile?.focus();
    expect(focused().getAttribute("data-tile")).toBe("mv1");

    await act(async () => {
      state.handlers.get("mv2")?.onEvent(goal("mv2", 1000, { home: 0, away: 1 }));
      await vi.advanceTimersByTimeAsync(1100);
    });

    await waitFor(() => {
      expect(document.querySelector("[data-expanded='mv2']")).not.toBeNull();
    });
    await waitFor(() => {
      expect(focused().getAttribute("data-tile")).toBe("mv2");
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(16_000);
    });

    await waitFor(() => {
      expect(document.querySelector("[data-expanded]")).toBeNull();
    });
    await waitFor(() => {
      expect(focused()).toBeTruthy();
    });
  });

  it("Multi-match with the goal switch off never leaves the split", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    updateSettings((s) => ({ ...s, autoSwitchOnGoal: false }));
    state.matches = [match("off1"), match("off2")];
    mount("/multi?view=2", [{ path: "/multi", Component: MultiScreen }]);

    await waitFor(() => {
      expect(state.handlers.has("off1")).toBe(true);
    });
    await act(async () => {
      state.handlers.get("off1")?.onEvent(goal("off1", 1000, { home: 1, away: 0 }));
      await vi.advanceTimersByTimeAsync(1100);
    });
    expect(document.querySelector("[data-expanded]")).toBeNull();
    expect(focused()).toBeTruthy();
  });

  it("Feed lands on the spotlight and keeps focus as commentary arrives", async () => {
    state.matches = [
      match("fd1", { score: { home: 1, away: 0 }, events: [event("GOAL", 12, { home: 1, away: 0 })] }),
      match("fd2", { score: { home: 0, away: 0 }, events: [event("CORNER", 3, { home: 0, away: 0 })] }),
    ];
    mount("/feed", [{ path: "/feed", Component: FeedScreen }]);

    await waitFor(() => {
      expect(focused()).toHaveTextContent("Watch full screen");
    });
    expect(screen.getByRole("region", { name: "Match of the moment" })).toHaveTextContent(state.matches[0]?.home.name ?? "");

    await waitFor(() => {
      expect(state.handlers.has("fd2")).toBe(true);
    });
    act(() => {
      state.handlers.get("fd2")?.onEvent({ ...event("SHOT", 20, { home: 0, away: 0 }), matchId: "fd2" as MatchEventView["matchId"], sequence: 500, occurredAt: new Date().toISOString() });
    });
    await waitFor(() => {
      expect(screen.getByRole("list", { name: "Live commentary" })).toHaveTextContent("Shot");
    });
    expect(focused()).toHaveTextContent("Watch full screen");
    expect(screen.queryByText(/next event|next goal/i)).toBeNull();
  });

  it("Feed with nothing in play still offers a focus target", async () => {
    state.matches = [match("up1", { phase: "BETTING_OPEN", status: "BETTING_OPEN" })];
    mount("/feed", [{ path: "/feed", Component: FeedScreen }]);

    await waitFor(() => {
      expect(focused()).toHaveTextContent("All upcoming matches");
    });
  });

  it("Settings starts on sound, which is off, and keeps focus while toggling", async () => {
    state.leagues = [league("league-1", "Alpha")];
    state.teams = [team("tm1", "ONE"), team("tm2", "TWO")];
    mount("/settings", [{ path: "/settings", Component: SettingsScreen }]);

    await waitFor(() => {
      expect(focused()).toHaveTextContent("Sound effects");
    });
    expect(focused()).toHaveTextContent("Off");
    expect(focused().getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(focused());
    await waitFor(() => {
      expect(focused()).toHaveTextContent("On");
    });

    const follow = await screen.findByRole("button", { name: "Follow ONE Town" });

    follow.focus();
    fireEvent.click(follow);
    await waitFor(() => {
      expect(focused().getAttribute("aria-label")).toBe("Unfollow ONE Town");
    });
  });

  it("Replay lands on the play control and keeps it while the timeline plays", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    state.matches = [
      match("rp1", {
        phase: "FINISHED",
        status: "COMPLETED",
        score: { home: 1, away: 0 },
        events: [event("KICK_OFF", 0, { home: 0, away: 0 }), event("GOAL", 2, { home: 1, away: 0 }), event("FULL_TIME", 4, { home: 1, away: 0 })],
      }),
    ];
    mount("/replay/rp1", [{ path: "/replay/:matchId", Component: ReplayScreen }]);

    await waitFor(() => {
      expect(focused().getAttribute("aria-label")).toBe("Pause replay");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    await waitFor(() => {
      expect(focused().getAttribute("aria-label")).toBe("Play replay");
    });
    expect(screen.getByRole("list", { name: "Recorded events" })).toHaveTextContent("Goal");
  });

  it("Replay of a match still in play offers the live match instead", async () => {
    state.matches = [match("rp2")];
    mount("/replay/rp2", [{ path: "/replay/:matchId", Component: ReplayScreen }]);

    await waitFor(() => {
      expect(focused()).toHaveTextContent("Watch the match");
    });
  });

  it("the schedule overlay swallows movement and closes on Back without moving focus", async () => {
    const onBack = vi.fn();

    cleanups.push(installRemote({ onBack }));
    mount("/", [
      {
        path: "/",
        Component: () => (
          <button type="button" data-tv-focusable="" data-tv-autofocus="">
            under
          </button>
        ),
      },
    ]);
    await waitFor(() => {
      expect(focused()).toHaveTextContent("under");
    });

    const onClose = vi.fn();
    const { unmount } = render(<ScheduleOverlay onClose={onClose} />);

    fireEvent.keyDown(document.activeElement ?? document.body, { key: "ArrowDown" });
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onBack).not.toHaveBeenCalled();
    expect(focused()).toHaveTextContent("under");
    unmount();
  });
});
