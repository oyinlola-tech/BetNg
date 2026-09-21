import "@testing-library/jest-dom/vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataSourceError, formatMoney, formatSignedMoney, localDayRange, type PageView, type TransactionQuery, type TransactionView, type WalletView } from "@betng/ui-core";
import { fakeDataSource, renderAccount, resetClientState, transaction, wallet } from "../helpers/account";

beforeEach(() => {
  resetClientState();
});

describe("wallet", () => {
  it("shows the platform's figures and omits pending when it is not supplied", async () => {
    renderAccount({ route: "/wallet", dataSource: fakeDataSource({ getWallet: async () => wallet(750_000, { balance: 900_000, reserved: 150_000 }) }) });

    expect(await screen.findByTestId("wallet-available")).toHaveTextContent(formatMoney(750_000));
    expect(screen.getByText("Balance").nextElementSibling).toHaveTextContent(formatMoney(900_000));
    expect(screen.getByText("Reserved").nextElementSibling).toHaveTextContent(formatMoney(150_000));
    expect(screen.queryByText("Pending")).not.toBeInTheDocument();
    expect(screen.getByText(/no real money is involved/i)).toBeInTheDocument();
  });

  it("labels client-side sums as belonging to this page", async () => {
    const items = [transaction(1, { amount: 200_000 }), transaction(2, { type: "BET_STAKE", amount: -50_000, description: "Stake" })];

    renderAccount({ route: "/wallet", dataSource: fakeDataSource({ queryTransactions: async () => ({ items, page: 1, pageSize: 8, total: 40 }) }) });

    const heading = await screen.findByRole("heading", { name: "This page" });
    const card = heading.closest("div")?.parentElement as HTMLElement;

    expect(within(card).getByText(/These are not account totals/)).toBeInTheDocument();
    expect(within(card).getByText(formatSignedMoney(-50_000))).toBeInTheDocument();
  });

  it("validates the deposit amount and sends minor units", async () => {
    const user = userEvent.setup();
    const deposit = vi.fn(async () => wallet(1_250_000));

    renderAccount({ route: "/wallet", dataSource: fakeDataSource({ deposit }) });

    await user.click(await screen.findByRole("button", { name: "Deposit" }));

    const dialog = await screen.findByRole("dialog", { name: "Add simulated funds" });

    await user.click(within(dialog).getByRole("button", { name: "Add funds" }));

    expect(await within(dialog).findByText("Enter an amount.")).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText("Amount"), "12abc");
    await user.click(within(dialog).getByRole("button", { name: "Add funds" }));

    expect(await within(dialog).findByText(/Enter an amount in digits/)).toBeInTheDocument();
    expect(deposit).not.toHaveBeenCalled();

    await user.clear(within(dialog).getByLabelText("Amount"));
    await user.type(within(dialog).getByLabelText("Amount"), "2,500.50");
    await user.click(within(dialog).getByRole("button", { name: "Add funds" }));

    await waitFor(() => {
      expect(deposit).toHaveBeenCalledWith(250_050);
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Add simulated funds" })).not.toBeInTheDocument();
    });
  });

  it("puts a backend field error on the amount and keeps the balance until it is re-read", async () => {
    const user = userEvent.setup();
    const getWallet = vi.fn<() => Promise<WalletView>>().mockResolvedValue(wallet(500_000));
    const deposit = vi.fn(async () => {
      throw new DataSourceError("VALIDATION", "amount: over daily limit (internal)", { fields: { amount: "Deposits are limited to ₦1,000 a day." } });
    });

    renderAccount({ route: "/wallet", dataSource: fakeDataSource({ getWallet, deposit }) });

    await user.click(await screen.findByRole("button", { name: "Deposit" }));

    const dialog = await screen.findByRole("dialog", { name: "Add simulated funds" });

    await user.type(within(dialog).getByLabelText("Amount"), "5000");
    await user.click(within(dialog).getByRole("button", { name: "Add funds" }));

    expect(await within(dialog).findByText("Deposits are limited to ₦1,000 a day.")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Amount")).toHaveAttribute("aria-invalid", "true");
    expect(within(dialog).queryByText(/internal/)).not.toBeInTheDocument();
    expect(screen.getByTestId("wallet-available")).toHaveTextContent(formatMoney(500_000));
    expect(getWallet).toHaveBeenCalledTimes(1);
  });

  it("refuses an obvious over-withdrawal before sending it", async () => {
    const user = userEvent.setup();
    const withdraw = vi.fn();

    renderAccount({ route: "/wallet", dataSource: fakeDataSource({ getWallet: async () => wallet(100_000), withdraw }) });

    await user.click(await screen.findByRole("button", { name: "Withdraw" }));

    const dialog = await screen.findByRole("dialog", { name: "Withdraw simulated funds" });

    await user.type(within(dialog).getByLabelText("Amount"), "5000");
    await user.click(within(dialog).getByRole("button", { name: "Withdraw" }));

    expect(await within(dialog).findByText(`You can withdraw up to ${formatMoney(100_000)}.`)).toBeInTheDocument();
    expect(withdraw).not.toHaveBeenCalled();
  });
});

describe("transactions", () => {
  function pagedSource(total: number) {
    const queryTransactions = vi.fn(
      async (query: TransactionQuery): Promise<PageView<TransactionView>> => ({
        items: [transaction(query.page ?? 1, { description: `Row on page ${String(query.page ?? 1)}`, reference: "REF-1" })],
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 20,
        total,
      }),
    );

    return { queryTransactions, dataSource: fakeDataSource({ queryTransactions }) };
  }

  it("reads its filters from the URL and asks the platform for that page", async () => {
    const { queryTransactions, dataSource } = pagedSource(95);

    renderAccount({ route: "/transactions?type=deposit,bet_stake&status=completed&from=2026-09-01&to=2026-09-10&q=bonus&page=3&sort=amount&dir=asc", dataSource });

    expect(await screen.findAllByText("Row on page 3")).not.toHaveLength(0);
    expect(queryTransactions).toHaveBeenCalledWith({
      page: 3,
      pageSize: 20,
      sort: "amount",
      direction: "asc",
      types: ["DEPOSIT", "BET_STAKE"],
      statuses: ["COMPLETED"],
      from: localDayRange("2026-09-01").from,
      to: localDayRange("2026-09-10").to,
      search: "bonus",
    });
    expect(screen.getByRole("searchbox", { name: "Search transactions" })).toHaveValue("bonus");
  });

  it("writes filter and page changes to the URL and re-queries from page one", async () => {
    const user = userEvent.setup();
    const { queryTransactions, dataSource } = pagedSource(95);

    renderAccount({ route: "/transactions?page=2", dataSource });

    await screen.findAllByText("Row on page 2");
    await user.click(screen.getByRole("button", { name: "Next page" }));

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/transactions?page=3");
    });
    expect(queryTransactions).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3, pageSize: 20 }));

    await user.click(screen.getByRole("button", { name: "Filter by type" }));
    await user.click(await screen.findByRole("checkbox", { name: "Withdrawal" }));

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/transactions?type=withdrawal");
    });
    expect(queryTransactions).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, types: ["WITHDRAWAL"] }));
  });

  it("opens a transaction's detail from its row", async () => {
    const user = userEvent.setup();
    const { dataSource } = pagedSource(1);

    renderAccount({ route: "/transactions", dataSource });

    const table = await screen.findByRole("table", { name: "Wallet transactions" });

    await user.click(await within(table).findByText("Row on page 1"));

    const dialog = await screen.findByRole("dialog", { name: "Transaction" });

    expect(within(dialog).getByText("REF-1")).toBeInTheDocument();
    expect(within(dialog).getByText(formatSignedMoney(100_000))).toBeInTheDocument();
  });

  it("renders a transaction type the client does not know yet", async () => {
    const grant = { ...transaction(1), type: "WELCOME_GRANT", description: undefined } as unknown as TransactionView;

    renderAccount({ route: "/transactions", dataSource: fakeDataSource({ queryTransactions: async () => ({ items: [grant], page: 1, pageSize: 20, total: 1 }) }) });

    const table = await screen.findByRole("table", { name: "Wallet transactions" });

    expect(await within(table).findAllByText("Welcome grant")).toHaveLength(2);
  });

  it("shows a filtered empty state", async () => {
    renderAccount({ route: "/transactions?status=failed", dataSource: fakeDataSource() });

    expect(await screen.findByText("No transactions match these filters")).toBeInTheDocument();
  });
});
