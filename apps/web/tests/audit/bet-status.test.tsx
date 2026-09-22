import "@testing-library/jest-dom/vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatMoney, type BetSignal, type BetView, type MatchView } from "@betng/ui-core";
import { useBetSignals } from "../../src/hooks/useBetSignals";
import { useBets } from "../../src/hooks/accountQueries";
import { TicketsPage } from "../../src/pages/TicketsPage";
import { fakeData, liveMatch, openBet, renderHarness, resetState, resultMarket } from "./harness";

function SignalHost(): React.JSX.Element {
  useBetSignals();

  const bets = useBets();

  return <p data-testid="bets">{bets.data?.map((bet) => `${bet.id}:${bet.status}`).join(",") ?? "loading"}</p>;
}

function signalSource(bets: () => readonly BetView[], getBet: (id: string) => BetView) {
  let emit: ((signal: BetSignal) => void) | undefined;
  const dataSource = fakeData({
    listBets: vi.fn(async () => bets()),
    getBet: vi.fn(async (id: string) => getBet(id)),
    getWallet: vi.fn(async () => ({ id: "w-1", balance: 1, reserved: 0, available: 1, currency: "NGN", simulated: true }) as never),
    queryTransactions: vi.fn(async () => ({ items: [], page: 1, pageSize: 8, total: 0 })),
    subscribeBetSignals: (listener) => {
      emit = listener;

      return () => {
        emit = undefined;
      };
    },
  });

  return {
    dataSource,
    emit: (signal: BetSignal) => {
      act(() => {
        emit?.(signal);
      });
    },
  };
}

beforeEach(() => {
  resetState();
});

describe("realtime bet status", () => {
  it("re-reads the bet a settlement signal names and announces the figure the platform reports", async () => {
    let current = openBet("bet-7", "m1");
    const { dataSource, emit } = signalSource(
      () => [current],
      () => current,
    );

    renderHarness({ routes: [{ path: "/", element: <SignalHost /> }], dataSource });
    await waitFor(() => {
      expect(screen.getByTestId("bets")).toHaveTextContent("bet-7:PENDING");
    });

    current = { ...current, status: "WON", payout: 84_500, settledAt: "2026-09-22T11:00:00.000Z" };
    emit({ kind: "BET_SETTLED", betId: "bet-7" });

    expect(await screen.findByText(`Bet settled — won ${formatMoney(84_500)}`)).toBeInTheDocument();
    expect(dataSource.getBet).toHaveBeenCalledWith("bet-7");
    await waitFor(() => {
      expect(screen.getByTestId("bets")).toHaveTextContent("bet-7:WON");
    });
    expect(screen.getByRole("button", { name: "View ticket", hidden: true })).toBeInTheDocument();
  });

  it("says nothing when the re-read shows no change, and announces a settlement only once", async () => {
    let current = openBet("bet-8", "m1");
    const { dataSource, emit } = signalSource(
      () => [current],
      () => current,
    );

    renderHarness({ routes: [{ path: "/", element: <SignalHost /> }], dataSource });
    await waitFor(() => {
      expect(screen.getByTestId("bets")).toHaveTextContent("bet-8:PENDING");
    });

    emit({ kind: "BET_UPDATED", betId: "bet-8" });
    await waitFor(() => {
      expect(dataSource.getBet).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByText(/Bet settled/)).not.toBeInTheDocument();

    current = { ...current, status: "LOST" };
    emit({ kind: "BET_SETTLED", betId: "bet-8" });
    emit({ kind: "BET_SETTLED", betId: "bet-8" });

    expect(await screen.findByText("Bet settled — lost")).toBeInTheDocument();
    emit({ kind: "BET_SETTLED", betId: "bet-8" });
    await waitFor(() => {
      expect(vi.mocked(dataSource.getBet).mock.calls.length).toBeGreaterThanOrEqual(3);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(screen.getAllByText("Bet settled — lost")).toHaveLength(1);
  });

  it("without a bet id, diffs the re-read list against what was shown and ignores bets settled earlier", async () => {
    let list: readonly BetView[] = [openBet("old", "m1", { status: "WON", payout: 1_000 }), openBet("new", "m2")];
    const { dataSource, emit } = signalSource(
      () => list,
      () => {
        throw new Error("not expected");
      },
    );

    renderHarness({ routes: [{ path: "/", element: <SignalHost /> }], dataSource });
    await waitFor(() => {
      expect(screen.getByTestId("bets")).toHaveTextContent("new:PENDING");
    });

    list = [list[0] as BetView, { ...(list[1] as BetView), status: "VOID", payout: 20_000 }];
    emit({ kind: "BET_SETTLED" });

    expect(await screen.findByText("Bet void")).toBeInTheDocument();
    expect(screen.getByText(`The platform voided this bet and returned ${formatMoney(20_000)}.`)).toBeInTheDocument();
    expect(screen.queryByText(/won/)).not.toBeInTheDocument();
  });
});

describe("live bets", () => {
  it("shows open bets on matches in play with the live score and the current price, read-only", async () => {
    const match = liveMatch("m1");
    const view: MatchView = { ...match, events: [], score: { home: 3, away: 1 } };
    const dataSource = fakeData({
      listBets: async () => [openBet("bet-1", "m1"), openBet("bet-2", "m9"), openBet("bet-3", "m1", { status: "WON" })],
      listMatches: async (filter) => (filter?.phases?.includes("LIVE") === true ? [match, liveMatch("m5")] : []),
      getMatch: async () => view,
      getMatchMarkets: async (matchId) => ({ matchId, markets: [resultMarket(matchId, [1.45, 4, 6])], generatedAt: "2026-09-22T10:40:00.000Z" }),
    });

    renderHarness({ route: "/tickets", routes: [{ path: "/tickets", element: <TicketsPage /> }], dataSource });

    const section = await screen.findByRole("region", { name: "Live bets" });
    const table = await within(section).findByRole("table", { name: "Your open selections on this match" });

    await waitFor(() => {
      expect(within(table).getByText("1.45")).toBeInTheDocument();
    });
    expect(within(table).getByText("2.00")).toBeInTheDocument();
    expect(within(table).getAllByRole("row")).toHaveLength(2);
    expect(within(section).queryByRole("button", { name: /1\.45/ })).not.toBeInTheDocument();
    await waitFor(() => {
      expect(within(section).getAllByText("3").length).toBeGreaterThan(0);
    });
  });

  it("is absent when no open bet is on a match in play", async () => {
    const listMatches = vi.fn(async () => [liveMatch("m2")]);
    const dataSource = fakeData({ listBets: async () => [openBet("bet-1", "m1")], listMatches });

    renderHarness({ route: "/tickets", routes: [{ path: "/tickets", element: <TicketsPage /> }], dataSource });

    expect((await screen.findAllByText("Home")).length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(listMatches).toHaveBeenCalled();
    });
    expect(screen.queryByRole("region", { name: "Live bets" })).not.toBeInTheDocument();
  });
});
