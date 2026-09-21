import "@testing-library/jest-dom/vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataSourceError, formatMoney, type BetPlacementView, type PlaceBetInput, type WalletView } from "@betng/ui-core";
import { BetSlipPanel, useSlipSelection } from "../../src/features/betslip";
import { useWallet } from "../../src/hooks/accountQueries";
import { useBetSlip } from "../../src/stores/betslip.store";
import { bet, fakeDataSource, market, matchSummary, renderAccount, resetClientState, slipSelection, wallet } from "../helpers/account";

function Picks(): React.JSX.Element {
  const { selectedIds, toggle } = useSlipSelection();

  return (
    <div>
      {["m1", "m2"].flatMap((matchId) => {
        const source = market(matchId);

        return source.selections.map((selection) => (
          <button
            key={selection.id}
            type="button"
            aria-pressed={selectedIds.has(selection.id)}
            onClick={() => {
              toggle(selection, source, matchSummary(matchId));
            }}
          >
            {`Pick ${matchId} ${selection.label}`}
          </button>
        ));
      })}
    </div>
  );
}

function WalletReadout(): React.JSX.Element {
  const current = useWallet();

  return <p data-testid="wallet">{current.data === undefined ? "loading" : formatMoney(current.data.available)}</p>;
}

function Host(): React.JSX.Element {
  return (
    <>
      <Picks />
      <WalletReadout />
      <BetSlipPanel />
    </>
  );
}

const HOST = [{ path: "host", element: <Host /> }];

function accepted(input: PlaceBetInput, overrides: Partial<BetPlacementView> = {}): BetPlacementView {
  return {
    outcome: "ACCEPTED",
    clientReference: input.clientReference,
    bet: bet({ stake: input.stake, potentialPayout: 39_500, reference: "PLATFORM-REF-77" }),
    ...overrides,
  };
}

function slip(): HTMLElement {
  return screen.getByRole("region", { name: "Bet slip" });
}

beforeEach(() => {
  resetClientState();
});

describe("bet slip draft", () => {
  it("adds, replaces within a match and removes selections", async () => {
    const user = userEvent.setup();

    renderAccount({ route: "/host", routes: HOST });

    expect(within(slip()).getByText("Your bet slip is empty")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Pick m1 Home" }));
    await user.click(screen.getByRole("button", { name: "Pick m2 Away" }));

    const list = within(slip()).getByRole("list", { name: "Selections" });

    expect(within(list).getAllByRole("listitem")).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Pick m1 Draw" }));

    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(within(list).getByText("Draw")).toBeInTheDocument();
    expect(within(list).queryByText("Home")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pick m1 Home" })).toHaveAttribute("aria-pressed", "false");

    await user.click(within(list).getByRole("button", { name: /Remove Away/ }));

    expect(within(list).getAllByRole("listitem")).toHaveLength(1);

    await user.click(within(slip()).getByRole("button", { name: "Clear all" }));

    expect(within(slip()).getByText("Your bet slip is empty")).toBeInTheDocument();
  });

  it("labels the total as an estimate and shows the platform's payout once accepted", async () => {
    const user = userEvent.setup();
    const placeBet = vi.fn(async (input: PlaceBetInput) => accepted(input));

    useBetSlip.setState({ selections: [slipSelection("m1")], stake: 20_000 });
    renderAccount({ route: "/host", routes: HOST, dataSource: fakeDataSource({ placeBet }) });

    expect(within(slip()).getByText("Estimated return")).toBeInTheDocument();
    expect(within(slip()).getByText(formatMoney(40_000))).toBeInTheDocument();

    await user.click(await within(slip()).findByRole("button", { name: "Place bet" }));

    expect(await within(slip()).findByText("Bet accepted")).toBeInTheDocument();
    expect(within(slip()).getByText("Potential payout")).toBeInTheDocument();
    expect(within(slip()).getByText(formatMoney(39_500))).toBeInTheDocument();
    expect(within(slip()).getByText("PLATFORM-REF-77")).toBeInTheDocument();
    expect(within(slip()).queryByText("Estimated return")).not.toBeInTheDocument();
    expect(useBetSlip.getState().selections).toHaveLength(0);
  });
});

describe("submission reference", () => {
  it("sends one reference per attempt, reuses it after a network failure and renews it when the slip changes", async () => {
    const user = userEvent.setup();
    const references: string[] = [];
    let failures = 1;
    const placeBet = vi.fn(async (input: PlaceBetInput): Promise<BetPlacementView> => {
      references.push(input.clientReference);

      if (failures > 0) {
        failures -= 1;
        throw new DataSourceError("NETWORK", "socket hang up");
      }

      return { outcome: "REJECTED", clientReference: input.clientReference, reason: "RISK_REJECTED" };
    });

    useBetSlip.setState({ selections: [slipSelection("m1")], stake: 20_000 });
    renderAccount({ route: "/host", routes: HOST, dataSource: fakeDataSource({ placeBet }) });

    await user.click(await within(slip()).findByRole("button", { name: "Place bet" }));

    expect(await within(slip()).findByText("Something went wrong")).toBeInTheDocument();
    expect(within(slip()).queryByText(/socket hang up/)).not.toBeInTheDocument();
    expect(placeBet).toHaveBeenCalledTimes(1);

    await user.click(within(slip()).getByRole("button", { name: "Try again" }));

    expect(await within(slip()).findByText("Bet not accepted")).toBeInTheDocument();
    expect(references).toHaveLength(2);
    expect(references[1]).toBe(references[0]);

    const stake = within(slip()).getByLabelText("Stake");

    await user.clear(stake);
    await user.type(stake, "300");
    await user.click(within(slip()).getByRole("button", { name: "Place bet" }));

    await waitFor(() => {
      expect(references).toHaveLength(3);
    });
    expect(references[2]).not.toBe(references[0]);
    expect(placeBet.mock.calls[2]?.[0].stake).toBe(30_000);
  });
});

describe("platform decisions", () => {
  it("offers the platform's maximum stake when the stake is limited", async () => {
    const user = userEvent.setup();
    const placeBet = vi.fn(
      async (input: PlaceBetInput): Promise<BetPlacementView> => ({
        outcome: "REJECTED",
        clientReference: input.clientReference,
        reason: "STAKE_LIMITED",
        maxStake: 15_000,
      }),
    );

    useBetSlip.setState({ selections: [slipSelection("m1")], stake: 50_000 });
    renderAccount({ route: "/host", routes: HOST, dataSource: fakeDataSource({ placeBet }) });

    await user.click(await within(slip()).findByRole("button", { name: "Place bet" }));

    const alert = await within(slip()).findByRole("alert");

    expect(within(alert).getByText("Bet not accepted")).toBeInTheDocument();
    expect(screen.getAllByText("Bet not accepted")).toHaveLength(1);

    await user.click(within(alert).getByRole("button", { name: `Use ${formatMoney(15_000)}` }));

    expect(useBetSlip.getState().stake).toBe(15_000);
    expect(within(slip()).getByLabelText("Stake")).toHaveValue("150.00");
    expect(within(slip()).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("highlights refused selections and removes them on request", async () => {
    const user = userEvent.setup();
    const closed = slipSelection("m2");
    const placeBet = vi.fn(
      async (input: PlaceBetInput): Promise<BetPlacementView> => ({
        outcome: "REJECTED",
        clientReference: input.clientReference,
        reason: "MARKET_CLOSED",
        rejectedSelectionIds: [closed.selectionId],
      }),
    );

    useBetSlip.setState({ selections: [slipSelection("m1"), closed], stake: 20_000 });
    renderAccount({ route: "/host", routes: HOST, dataSource: fakeDataSource({ placeBet }) });

    await user.click(await within(slip()).findByRole("button", { name: "Place bet" }));
    await within(slip()).findByRole("alert");

    const items = within(within(slip()).getByRole("list", { name: "Selections" })).getAllByRole("listitem");

    expect(items[0]).toHaveAttribute("data-status", "OK");
    expect(items[1]).toHaveAttribute("data-status", "CLOSED");

    await user.click(within(slip()).getByRole("button", { name: "Remove closed selections" }));

    expect(useBetSlip.getState().selections.map((s) => s.selectionId)).toEqual([slipSelection("m1").selectionId]);
  });

  it("shows both stakes when the platform accepts a smaller one", async () => {
    const user = userEvent.setup();
    const placeBet = vi.fn(async (input: PlaceBetInput) =>
      accepted(input, { outcome: "LIMITED", reason: "STAKE_LIMITED", bet: bet({ stake: 12_000, potentialPayout: 24_000 }) }),
    );

    useBetSlip.setState({ selections: [slipSelection("m1")], stake: 50_000 });
    renderAccount({ route: "/host", routes: HOST, dataSource: fakeDataSource({ placeBet }) });

    await user.click(await within(slip()).findByRole("button", { name: "Place bet" }));

    expect(await within(slip()).findByText("Stake limited")).toBeInTheDocument();
    expect(within(slip()).getByText("Stake entered").nextElementSibling).toHaveTextContent(formatMoney(50_000));
    expect(within(slip()).getByText("Stake accepted").nextElementSibling).toHaveTextContent(formatMoney(12_000));
    expect(within(slip()).getByText(formatMoney(24_000))).toBeInTheDocument();
  });

  it("blocks submission while a selection is suspended", async () => {
    const placeBet = vi.fn();
    const dataSource = fakeDataSource({
      placeBet,
      getMatchMarkets: async (matchId) => ({ matchId, markets: [market(matchId, { status: "SUSPENDED" })], generatedAt: "2026-09-21T12:00:00.000Z" }),
    });

    useBetSlip.setState({ selections: [slipSelection("m1")], stake: 20_000 });
    renderAccount({ route: "/host", routes: HOST, dataSource });

    expect(await within(slip()).findByText("Betting suspended")).toBeInTheDocument();
    expect(within(slip()).getByRole("button", { name: "Place bet" })).toBeDisabled();
    expect(within(slip()).getByRole("button", { name: "Remove unavailable selections" })).toBeEnabled();
    expect(placeBet).not.toHaveBeenCalled();
  });

  it("reports a moved price from the platform and asks for it to be accepted first", async () => {
    const user = userEvent.setup();
    const moved = market("m1");
    const dataSource = fakeDataSource({
      getMatchMarkets: async (matchId) => ({
        matchId,
        markets: [{ ...moved, selections: moved.selections.map((s) => (s.code === "1" ? { ...s, odds: 2.4 } : s)) }],
        generatedAt: "2026-09-21T12:00:00.000Z",
      }),
    });

    useBetSlip.setState({ selections: [slipSelection("m1")], stake: 20_000 });
    renderAccount({ route: "/host", routes: HOST, dataSource });

    expect(await within(slip()).findByText("Price changed")).toBeInTheDocument();
    expect(within(slip()).queryByRole("button", { name: "Place bet" })).not.toBeInTheDocument();

    await user.click(within(slip()).getByRole("button", { name: "Accept new prices" }));

    expect(useBetSlip.getState().selections[0]?.odds).toBe(2.4);
    expect(within(slip()).getByRole("button", { name: "Place bet" })).toBeEnabled();
  });
});

describe("sign-in and wallet", () => {
  it("asks a signed-out customer to sign in, keeps the slip and resumes the submission", async () => {
    const user = userEvent.setup();
    const placeBet = vi.fn(async (input: PlaceBetInput) => accepted(input));

    useBetSlip.setState({ selections: [slipSelection("m1")], stake: 20_000 });
    renderAccount({ route: "/host", routes: HOST, signedIn: false, dataSource: fakeDataSource({ placeBet }) });

    await user.click(await within(slip()).findByRole("button", { name: "Sign in to place bet" }));

    const dialog = await screen.findByRole("dialog", { name: "Sign in" });

    expect(placeBet).not.toHaveBeenCalled();
    expect(useBetSlip.getState().selections).toHaveLength(1);
    expect(within(dialog).getByText(/Your slip stays as it is/)).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText("Email"), "ada@example.test");
    await user.type(within(dialog).getByLabelText("Password"), "correct horse");
    await user.click(within(dialog).getByRole("button", { name: "Sign in" }));

    expect(await within(slip()).findByText("Bet accepted", undefined, { timeout: 3000 })).toBeInTheDocument();
    expect(placeBet).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("location")).toHaveTextContent("/host");
  });

  it("never changes the wallet before the platform's figure is re-read", async () => {
    const user = userEvent.setup();
    let release: ((value: WalletView) => void) | undefined;
    const getWallet = vi
      .fn<() => Promise<WalletView>>()
      .mockResolvedValueOnce(wallet(1_000_000))
      .mockImplementationOnce(
        () =>
          new Promise<WalletView>((resolve) => {
            release = resolve;
          }),
      );
    const placeBet = vi.fn(async (input: PlaceBetInput) => accepted(input));

    useBetSlip.setState({ selections: [slipSelection("m1")], stake: 20_000 });
    renderAccount({ route: "/host", routes: HOST, dataSource: fakeDataSource({ placeBet, getWallet }) });

    expect(await screen.findByText(formatMoney(1_000_000))).toBeInTheDocument();

    await user.click(within(slip()).getByRole("button", { name: "Place bet" }));
    await within(slip()).findByText("Bet accepted");

    await waitFor(() => {
      expect(getWallet).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByTestId("wallet")).toHaveTextContent(formatMoney(1_000_000));

    release?.(wallet(975_000));

    await waitFor(() => {
      expect(screen.getByTestId("wallet")).toHaveTextContent(formatMoney(975_000));
    });
  });

  it("links to the wallet when the balance does not cover the stake", async () => {
    useBetSlip.setState({ selections: [slipSelection("m1")], stake: 50_000 });
    renderAccount({ route: "/host", routes: HOST, dataSource: fakeDataSource({ getWallet: async () => wallet(10_000) }) });

    expect(await within(slip()).findByText(/does not cover this stake/)).toBeInTheDocument();
    expect(within(slip()).getByRole("link", { name: "Go to wallet" })).toHaveAttribute("href", "/wallet");
    expect(within(slip()).getByRole("button", { name: "Place bet" })).toBeDisabled();
  });
});
