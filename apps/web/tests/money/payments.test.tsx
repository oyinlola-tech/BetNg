import "@testing-library/jest-dom/vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BankAccount, DepositInitiateRequest, DepositInitiation, PaymentRecord, WithdrawalQuote } from "@betng/contracts";
import { DataSourceError, formatMoney } from "@betng/ui-core";
import { DepositFlow } from "../../src/features/payments/DepositFlow";
import { INITIAL_DEPOSIT, depositReducer, nextAttempt } from "../../src/features/payments/depositMachine";
import { WithdrawFlow } from "../../src/features/payments/WithdrawFlow";
import { fakeAccountServices, fakeDataSource, payment, renderMoney, resetClientState, wallet } from "./helpers";

beforeEach(() => {
  resetClientState();
});

const FAST = [15];

function initiation(record: PaymentRecord, extra: Partial<DepositInitiation> = {}): DepositInitiation {
  return { payment: record, expiresAt: "2026-09-21T10:30:00.000Z", ...extra };
}

async function startDeposit(user: ReturnType<typeof userEvent.setup>, amount = "2,500"): Promise<void> {
  const field = await screen.findByLabelText("Amount");

  await user.clear(field);
  await user.type(field, amount);
  await user.click(screen.getByRole("button", { name: /Continue to payment|Try again/ }));
}

describe("deposit state machine", () => {
  it("keeps the key for a retried attempt and mints one for a changed attempt", () => {
    const newKey = vi.fn().mockReturnValueOnce("k1").mockReturnValueOnce("k2");
    const first = nextAttempt(INITIAL_DEPOSIT, 1_000, "CARD", newKey);
    const failed = depositReducer(depositReducer(depositReducer(INITIAL_DEPOSIT, { type: "SUBMIT" }), { type: "INITIATE", attempt: first }), {
      type: "INITIATE_FAILED",
      error: new DataSourceError("NETWORK", "offline"),
    });

    expect(failed.phase).toBe("idle");
    expect(nextAttempt(failed, 1_000, "CARD", newKey).key).toBe("k1");
    expect(nextAttempt(failed, 2_000, "CARD", newKey).key).toBe("k2");
  });

  it("only reaches confirmed from the platform's CONFIRMED status", () => {
    let state = depositReducer(INITIAL_DEPOSIT, { type: "SUBMIT" });

    state = depositReducer(state, { type: "INITIATE", attempt: { key: "k", amount: 1_000, method: "CARD" } });
    state = depositReducer(state, { type: "INITIATED", result: initiation(payment()), redirectAllowed: false });
    expect(state.phase).toBe("processing");

    state = depositReducer(state, { type: "STATUS", payment: payment({ status: "PROCESSING" }) });
    expect(state.phase).toBe("processing");

    state = depositReducer(state, { type: "STATUS", payment: payment({ status: "CONFIRMED" }) });
    expect(state.phase).toBe("confirmed");
  });
});

describe("deposit flow", () => {
  it("initiates, processes and confirms only when the platform says CONFIRMED", async () => {
    const user = userEvent.setup();
    const initiateDeposit = vi.fn(async (request: DepositInitiateRequest) =>
      initiation(payment({ amount: request.amount }), { instructions: { title: "Transfer instructions", lines: ["Send the exact amount."] } }),
    );
    const verifyDeposit = vi
      .fn<(reference: string) => Promise<PaymentRecord>>()
      .mockResolvedValueOnce(payment({ amount: 250_000, status: "PROCESSING" }))
      .mockResolvedValue(payment({ amount: 250_000, status: "CONFIRMED", completedAt: "2026-09-21T10:05:00.000Z" }));

    renderMoney({ route: "/deposit", element: <DepositFlow checkoutHosts={[]} pollDelaysMs={[60_000]} />, services: fakeAccountServices({ payments: { initiateDeposit, verifyDeposit } }) });

    await startDeposit(user);

    expect(await screen.findByText("Transfer instructions")).toBeInTheDocument();
    expect(initiateDeposit).toHaveBeenCalledWith({ amount: 250_000, method: "CARD", returnPath: "/payments/return" }, expect.any(String));
    expect(await screen.findByText("Processing")).toBeInTheDocument();
    expect(screen.queryByText("Deposit confirmed")).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem("betng.payments.inflight")).toBe(JSON.stringify({ reference: "DEP000123", direction: "DEPOSIT" }));

    await user.click(screen.getByRole("button", { name: "Check status" }));

    expect(await screen.findByText("Deposit confirmed")).toBeInTheDocument();
    expect(screen.getByTestId("payment-amount")).toHaveTextContent(formatMoney(250_000));
    await waitFor(() => {
      expect(window.sessionStorage.getItem("betng.payments.inflight")).toBeNull();
    });
  });

  it("shows a failed deposit and never claims success", async () => {
    const user = userEvent.setup();
    const initiateDeposit = vi.fn(async () => initiation(payment()));
    const verifyDeposit = vi.fn(async () => payment({ status: "FAILED", failureReason: "The card issuer declined the charge." }));

    renderMoney({ route: "/deposit", element: <DepositFlow checkoutHosts={[]} pollDelaysMs={FAST} />, services: fakeAccountServices({ payments: { initiateDeposit, verifyDeposit } }) });

    await startDeposit(user);

    expect(await screen.findByText("Deposit not completed")).toBeInTheDocument();
    expect(screen.getByText("The card issuer declined the charge.")).toBeInTheDocument();
    expect(screen.queryByText("Deposit confirmed")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start a new deposit" })).toBeInTheDocument();
  });

  it("shows an expired deposit", async () => {
    const user = userEvent.setup();
    const initiateDeposit = vi.fn(async () => initiation(payment()));
    const verifyDeposit = vi.fn(async () => payment({ status: "EXPIRED" }));

    renderMoney({ route: "/deposit", element: <DepositFlow checkoutHosts={[]} pollDelaysMs={FAST} />, services: fakeAccountServices({ payments: { initiateDeposit, verifyDeposit } }) });

    await startDeposit(user);

    expect(await screen.findByText("Deposit expired")).toBeInTheDocument();
    expect(screen.getByText("Expired")).toBeInTheDocument();
  });

  it("refuses to redirect to a checkout host outside the allowlist", async () => {
    const user = userEvent.setup();
    const onRedirect = vi.fn();
    const initiateDeposit = vi.fn(async () => initiation(payment(), { checkoutUrl: "https://checkout.evil.example/pay/abc" }));

    renderMoney({
      route: "/deposit",
      element: <DepositFlow checkoutHosts={["checkout.paystack.com"]} onRedirect={onRedirect} />,
      services: fakeAccountServices({ payments: { initiateDeposit } }),
    });

    await startDeposit(user);

    expect(await screen.findByText("Payment page blocked")).toBeInTheDocument();
    expect(onRedirect).not.toHaveBeenCalled();
    expect(screen.queryByText(/evil\.example/)).not.toBeInTheDocument();
  });

  it("redirects to an allowlisted checkout", async () => {
    const user = userEvent.setup();
    const onRedirect = vi.fn();
    const initiateDeposit = vi.fn(async () => initiation(payment(), { checkoutUrl: "https://checkout.paystack.com/abc" }));

    renderMoney({
      route: "/deposit",
      element: <DepositFlow checkoutHosts={["checkout.paystack.com"]} onRedirect={onRedirect} />,
      services: fakeAccountServices({ payments: { initiateDeposit } }),
    });

    await startDeposit(user);

    await waitFor(() => {
      expect(onRedirect).toHaveBeenCalledWith("https://checkout.paystack.com/abc");
    });
    expect(onRedirect).toHaveBeenCalledTimes(1);
  });

  it("reuses the idempotency key when the same attempt is retried and uses a new one for a new deposit", async () => {
    const user = userEvent.setup();
    const initiateDeposit = vi
      .fn<(request: DepositInitiateRequest, key: string) => Promise<DepositInitiation>>()
      .mockRejectedValueOnce(new DataSourceError("NETWORK", "Network error"))
      .mockResolvedValue(initiation(payment()));
    const verifyDeposit = vi.fn(async () => payment({ status: "FAILED" }));

    renderMoney({ route: "/deposit", element: <DepositFlow checkoutHosts={[]} pollDelaysMs={FAST} />, services: fakeAccountServices({ payments: { initiateDeposit, verifyDeposit } }) });

    await startDeposit(user);
    expect(await screen.findByText("Connection problem")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Deposit not completed")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Start a new deposit" }));
    await startDeposit(user);

    await waitFor(() => {
      expect(initiateDeposit).toHaveBeenCalledTimes(3);
    });

    const keys = initiateDeposit.mock.calls.map((call) => call[1]);

    expect(keys[1]).toBe(keys[0]);
    expect(keys[2]).not.toBe(keys[0]);
  });

  it("shows Too many requests with the wait in seconds", async () => {
    const user = userEvent.setup();
    const initiateDeposit = vi.fn(async () => {
      throw new DataSourceError("RATE_LIMITED", "slow down", { retryAfterSeconds: 30, requestId: "req-42" });
    });

    renderMoney({ route: "/deposit", element: <DepositFlow checkoutHosts={[]} />, services: fakeAccountServices({ payments: { initiateDeposit } }) });

    await startDeposit(user);

    expect(await screen.findByText("Too many requests")).toBeInTheDocument();
    expect(screen.getByText(/Wait 30 seconds before trying again/)).toBeInTheDocument();
    expect(screen.getByText("req-42")).toBeInTheDocument();
  });
});

describe("deposit validation", () => {
  it("checks the amount when the field loses focus, then again as it changes", async () => {
    const user = userEvent.setup();
    const initiateDeposit = vi.fn();

    renderMoney({ route: "/deposit", element: <DepositFlow checkoutHosts={[]} pollDelaysMs={[60_000]} />, services: fakeAccountServices({ payments: { initiateDeposit } }) });

    const field = await screen.findByLabelText("Amount");

    await user.type(field, "abc");

    expect(field).toHaveAttribute("aria-invalid", "false");

    await user.tab();

    await waitFor(() => {
      expect(field).toHaveAttribute("aria-invalid", "true");
    });

    await user.clear(field);
    await user.type(field, "2500");

    await waitFor(() => {
      expect(field).toHaveAttribute("aria-invalid", "false");
    });
    expect(initiateDeposit).not.toHaveBeenCalled();
  });
});

describe("payment return", () => {
  it("resumes the in-flight payment kept for this tab", async () => {
    window.sessionStorage.setItem("betng.payments.inflight", JSON.stringify({ reference: "DEP000123", direction: "DEPOSIT" }));

    const verifyDeposit = vi.fn(async () => payment({ status: "CONFIRMED" }));

    renderMoney({ route: "/payments/return", services: fakeAccountServices({ payments: { verifyDeposit } }) });

    expect(await screen.findByText("Deposit confirmed")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/payments/DEP000123");
    expect(verifyDeposit).toHaveBeenCalledWith("DEP000123");
  });

  it("does not ask the platform about a malformed reference", async () => {
    const verifyDeposit = vi.fn();

    renderMoney({ route: "/payments/..%2Fadmin", services: fakeAccountServices({ payments: { verifyDeposit } }) });

    expect(await screen.findByText("Payment not found")).toBeInTheDocument();
    expect(verifyDeposit).not.toHaveBeenCalled();
  });
});

const ACCOUNT: BankAccount = {
  id: "BA1",
  bankCode: "058",
  bankName: "Guaranty Trust Bank",
  accountNumberMasked: "******6789",
  accountName: "ADA OBI",
  isDefault: true,
  verified: true,
  createdAt: "2026-09-01T10:00:00.000Z",
};

describe("withdrawal", () => {
  it("never shows completed before the platform confirms", async () => {
    const user = userEvent.setup();
    const quote: WithdrawalQuote = { amount: 500_000, fee: 2_500, netAmount: 497_500, currency: "NGN", expiresAt: new Date(Date.now() + 300_000).toISOString() };
    const requestWithdrawal = vi.fn(async () => payment({ reference: "WDR000777", direction: "WITHDRAWAL", amount: 500_000, fee: 2_500, netAmount: 497_500, bankAccountId: "BA1" }));
    const getWithdrawal = vi
      .fn<(reference: string) => Promise<PaymentRecord>>()
      .mockResolvedValueOnce(payment({ reference: "WDR000777", direction: "WITHDRAWAL", status: "PROCESSING", amount: 500_000, bankAccountId: "BA1" }))
      .mockResolvedValue(payment({ reference: "WDR000777", direction: "WITHDRAWAL", status: "CONFIRMED", amount: 500_000, bankAccountId: "BA1" }));

    renderMoney({
      route: "/withdraw",
      element: <WithdrawFlow pollDelaysMs={[60_000]} />,
      dataSource: fakeDataSource({ getWallet: async () => wallet(1_000_000) }),
      services: fakeAccountServices({ payments: { listBankAccounts: async () => [ACCOUNT], quoteWithdrawal: async () => quote, requestWithdrawal, getWithdrawal } }),
    });

    const amount = await screen.findByLabelText("Amount");

    expect(screen.getByRole("combobox", { name: /Bank account/ })).toHaveDisplayValue(/•••• 6789/);
    expect(screen.queryByText(/\d{10}/)).not.toBeInTheDocument();

    await user.type(amount, "20000");
    await user.click(screen.getByRole("button", { name: "Review withdrawal" }));
    expect(await screen.findByText(/Your available balance is/)).toBeInTheDocument();

    await user.clear(amount);
    await user.type(amount, "5000");
    await user.click(screen.getByRole("button", { name: "Review withdrawal" }));

    expect(await screen.findByText("Review withdrawal", { selector: "h2" })).toBeInTheDocument();
    expect(screen.getByText(formatMoney(497_500))).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Withdraw" }));
    expect(requestWithdrawal).not.toHaveBeenCalled();

    const dialog = await screen.findByRole("dialog", { name: "Confirm withdrawal" });

    await user.click(within(dialog).getByRole("button", { name: `Withdraw ${formatMoney(500_000)}` }));

    expect(await screen.findByText("Withdrawal processing")).toBeInTheDocument();
    expect(requestWithdrawal).toHaveBeenCalledWith({ amount: 500_000, bankAccountId: "BA1" }, expect.any(String));
    expect(screen.queryByText("Withdrawal completed")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Check status" }));

    expect(await screen.findByText("Withdrawal completed")).toBeInTheDocument();
  });

  it("chooses the payout account through the shared select", async () => {
    const user = userEvent.setup();
    const second: BankAccount = { ...ACCOUNT, id: "BA2", accountNumberMasked: "******4321", isDefault: false };
    const quoteWithdrawal = vi.fn(async (request: { amount: number; bankAccountId: string }): Promise<WithdrawalQuote> => ({ amount: request.amount, fee: 2_500, netAmount: request.amount - 2_500, currency: "NGN", expiresAt: new Date(Date.now() + 300_000).toISOString() }));

    renderMoney({
      route: "/withdraw",
      element: <WithdrawFlow pollDelaysMs={[60_000]} />,
      services: fakeAccountServices({ payments: { listBankAccounts: async () => [ACCOUNT, second], quoteWithdrawal } }),
    });

    const select = await screen.findByRole("combobox", { name: /Bank account/ });

    expect(select).toHaveAttribute("aria-required", "true");

    await user.selectOptions(select, "BA2");
    await user.type(screen.getByLabelText("Amount"), "1000");
    await user.click(screen.getByRole("button", { name: "Review withdrawal" }));

    await waitFor(() => {
      expect(quoteWithdrawal).toHaveBeenCalledWith(expect.objectContaining({ bankAccountId: "BA2" }));
    });
  });

  it("reuses the withdrawal key when the submit is retried", async () => {
    const user = userEvent.setup();
    const quote: WithdrawalQuote = { amount: 100_000, fee: 2_500, netAmount: 97_500, currency: "NGN", expiresAt: new Date(Date.now() + 300_000).toISOString() };
    const requestWithdrawal = vi
      .fn<(request: unknown, key: string) => Promise<PaymentRecord>>()
      .mockRejectedValueOnce(new DataSourceError("TIMEOUT", "timeout"))
      .mockResolvedValue(payment({ reference: "WDR000778", direction: "WITHDRAWAL", amount: 100_000 }));

    renderMoney({
      route: "/withdraw",
      element: <WithdrawFlow pollDelaysMs={[60_000]} />,
      services: fakeAccountServices({
        payments: { listBankAccounts: async () => [ACCOUNT], quoteWithdrawal: async () => quote, requestWithdrawal, getWithdrawal: async () => payment({ reference: "WDR000778", direction: "WITHDRAWAL", status: "PROCESSING" }) },
      }),
    });

    await user.type(await screen.findByLabelText("Amount"), "1000");
    await user.click(screen.getByRole("button", { name: "Review withdrawal" }));
    await user.click(await screen.findByRole("button", { name: "Withdraw" }));
    await user.click(within(await screen.findByRole("dialog", { name: "Confirm withdrawal" })).getByRole("button", { name: /^Withdraw / }));

    expect(await screen.findByText("That took too long")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));
    await user.click(within(await screen.findByRole("dialog", { name: "Confirm withdrawal" })).getByRole("button", { name: /^Withdraw / }));

    expect(await screen.findByText("Withdrawal processing")).toBeInTheDocument();
    expect(requestWithdrawal.mock.calls[1]?.[1]).toBe(requestWithdrawal.mock.calls[0]?.[1]);
  });
});

describe("bank accounts", () => {
  it("verifies with the bank and saves from the verification, never sending an account name", async () => {
    const user = userEvent.setup();
    const verifyBankAccount = vi.fn(async () => ({ verificationId: "NEQ1", bankCode: "058", accountName: "ADA OBI", accountNumberMasked: "******6789", expiresAt: "2026-09-21T11:00:00.000Z" }));
    const saveBankAccount = vi.fn(async () => ACCOUNT);
    const listBankAccounts = vi.fn<() => Promise<readonly BankAccount[]>>().mockResolvedValueOnce([]).mockResolvedValue([ACCOUNT]);

    renderMoney({
      route: "/wallet/bank-accounts",
      services: fakeAccountServices({ payments: { listBanks: async () => [{ code: "058", name: "Guaranty Trust Bank" }], listBankAccounts, verifyBankAccount, saveBankAccount } }),
    });

    expect(await screen.findByText("No saved bank accounts")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add bank account" }));

    await screen.findByRole("option", { name: "Guaranty Trust Bank" });
    await user.type(screen.getByLabelText("Account number"), "123");
    await user.click(screen.getByRole("button", { name: "Verify account" }));
    expect(await screen.findByText("Enter the 10-digit account number (NUBAN).")).toBeInTheDocument();
    expect(screen.getByText("Choose your bank.")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/^Bank/), "058");
    await user.clear(screen.getByLabelText("Account number"));
    await user.type(screen.getByLabelText("Account number"), "0123456789");
    await user.click(screen.getByRole("button", { name: "Verify account" }));

    expect(await screen.findByTestId("verified-account-name")).toHaveTextContent("ADA OBI");
    expect(verifyBankAccount).toHaveBeenCalledWith({ bankCode: "058", accountNumber: "0123456789" });
    expect(screen.queryByText("0123456789")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save account" }));

    await waitFor(() => {
      expect(saveBankAccount).toHaveBeenCalledWith("NEQ1", false);
    });
    expect(JSON.stringify(saveBankAccount.mock.calls)).not.toContain("ADA OBI");
    expect(await screen.findByRole("list", { name: "Saved bank accounts" })).toHaveTextContent("•••• 6789");
  });
});

describe("wallet overview with payments on", () => {
  it("links to the payment flows and lists open payments from the platform", async () => {
    const { WalletPage } = await import("../../src/pages/WalletPage");
    const listHistory = vi.fn(async () => ({
      items: [payment({ reference: "DEP000900", status: "PROCESSING", amount: 300_000 }), payment({ reference: "DEP000901", status: "CONFIRMED" })],
      page: 1,
      pageSize: 10,
      total: 2,
    }));

    renderMoney({
      route: "/wallet",
      element: <WalletPage />,
      dataSource: fakeDataSource({ getWallet: async () => wallet(750_000, { balance: 900_000, reserved: 150_000, pending: 300_000 }), queryTransactions: async (q) => ({ items: [], page: q.page ?? 1, pageSize: q.pageSize ?? 8, total: 0 }), subscribeAccount: () => () => undefined }),
      services: fakeAccountServices({ payments: { listHistory }, limits: { getSummary: async () => ({ limits: [], selfExclusion: { active: false }, restricted: false }) } }),
    });

    expect(await screen.findByTestId("wallet-available")).toHaveTextContent(formatMoney(750_000));
    expect(screen.getByRole("link", { name: "Deposit" })).toHaveAttribute("href", "/wallet/deposit");
    expect(screen.getByRole("link", { name: "Withdraw" })).toHaveAttribute("href", "/wallet/withdraw");
    expect(screen.getByText("Pending").nextElementSibling).toHaveTextContent(formatMoney(300_000));

    const open = await screen.findByRole("link", { name: /DEP000900/ });

    expect(open).toHaveAttribute("href", "/payments/DEP000900");
    expect(screen.queryByRole("link", { name: /DEP000901/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/no real money is involved/i)).not.toBeInTheDocument();
  });
});
