import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AccountDeletion, BankAccount, KycOverview, LimitsSummary, WithdrawalQuote } from "@betng/contracts";
import { DataSourceError, formatDateTime, formatMoney } from "@betng/ui-core";
import { ThemeProvider } from "@betng/ui-web";
import { PaymentStatusBadge, paymentStatusLabel } from "../../src/features/payments/PaymentStatusBadge";
import { PaymentTimeline, paymentTimeline } from "../../src/features/payments/PaymentTimeline";
import { WithdrawFlow } from "../../src/features/payments/WithdrawFlow";
import { AccountDeletionPage } from "../../src/pages/AccountDeletionPage";
import { WalletPage } from "../../src/pages/WalletPage";
import { fakeAccountServices, fakeDataSource, payment, renderMoney, resetClientState, wallet } from "./helpers";

beforeEach(() => {
  resetClientState();
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

const UNVERIFIED: KycOverview = { status: "NOT_STARTED", tier: "TIER_0", requirements: [] };

function withdrawal(overrides: Parameters<typeof payment>[0] = {}) {
  return payment({ reference: "WDR000555", direction: "WITHDRAWAL", amount: 500_000, ...overrides });
}

describe("payment status wording", () => {
  it("labels PENDING by direction", () => {
    expect(paymentStatusLabel("PENDING", "DEPOSIT")).toBe("Awaiting payment");
    expect(paymentStatusLabel("PENDING", "WITHDRAWAL")).toBe("Awaiting processing");
    expect(paymentStatusLabel("PENDING")).toBe("Pending");
    expect(paymentStatusLabel("PROCESSING", "WITHDRAWAL")).toBe("Processing");

    render(<PaymentStatusBadge status="PENDING" direction="WITHDRAWAL" />);

    expect(screen.getByText("Awaiting processing")).toBeInTheDocument();
    expect(screen.queryByText("Awaiting payment")).not.toBeInTheDocument();
  });
});

describe("payment timeline", () => {
  it("shows every step of a confirmed withdrawal with only the times the platform gave", () => {
    const record = withdrawal({ status: "CONFIRMED", createdAt: "2026-09-21T10:00:00.000Z", updatedAt: "2026-09-21T11:30:00.000Z", completedAt: "2026-09-21T11:00:00.000Z" });

    expect(paymentTimeline(record)).toEqual([
      { label: "Request received", state: "done", at: "2026-09-21T10:00:00.000Z" },
      { label: "Transfer in progress", state: "done" },
      { label: "Paid to your bank", state: "done", at: "2026-09-21T11:00:00.000Z" },
    ]);

    render(
      <ThemeProvider>
        <PaymentTimeline payment={record} />
      </ThemeProvider>,
    );

    const steps = within(screen.getByRole("list", { name: "Payment progress" })).getAllByRole("listitem");

    expect(steps).toHaveLength(3);
    expect(steps[2]).toHaveAttribute("aria-current", "step");
    expect(steps[1]?.querySelector("time")).toBeNull();
    expect(steps[2]).toHaveTextContent(formatDateTime("2026-09-21T11:00:00.000Z"));
  });

  it("stops a failed withdrawal at the failure and never claims the transfer ran", () => {
    const record = withdrawal({ status: "FAILED", createdAt: "2026-09-21T10:00:00.000Z", updatedAt: "2026-09-21T10:20:00.000Z" });
    const steps = paymentTimeline(record);

    expect(steps).toEqual([
      { label: "Request received", state: "done", at: "2026-09-21T10:00:00.000Z" },
      { label: "Transfer failed", state: "stopped", at: "2026-09-21T10:20:00.000Z" },
    ]);
  });

  it("marks the step a pending withdrawal is on", () => {
    render(
      <ThemeProvider>
        <PaymentTimeline payment={withdrawal({ status: "PROCESSING" })} />
      </ThemeProvider>,
    );

    const steps = screen.getAllByRole("listitem");

    expect(steps[1]).toHaveAttribute("aria-current", "step");
    expect(steps[1]).toHaveTextContent("Transfer in progress");
    expect(steps[2]).toHaveAttribute("data-state", "upcoming");
  });
});

describe("pending withdrawal banner", () => {
  const dataSource = () =>
    fakeDataSource({ getWallet: async () => wallet(500_000), queryTransactions: async (q) => ({ items: [], page: q.page ?? 1, pageSize: q.pageSize ?? 8, total: 0 }), subscribeAccount: () => () => undefined });
  const limits = { getSummary: async (): Promise<LimitsSummary> => ({ limits: [], selfExclusion: { active: false }, restricted: false }) };

  it("links a single held withdrawal to its status page", async () => {
    const listHistory = async () => ({ items: [withdrawal({ status: "PENDING" }), payment({ reference: "DEP000900", status: "PROCESSING" })], page: 1, pageSize: 10, total: 2 });

    renderMoney({ route: "/wallet", element: <WalletPage />, dataSource: dataSource(), services: fakeAccountServices({ payments: { listHistory }, limits }) });

    const banner = await screen.findByTestId("pending-withdrawal-banner");

    expect(banner).toHaveTextContent(`Your ${formatMoney(500_000)} withdrawal is waiting to be processed.`);
    expect(banner).toHaveTextContent("The amount is held");
    expect(within(banner).getByRole("link", { name: "View status" })).toHaveAttribute("href", "/payments/WDR000555?direction=withdrawal");
  });

  it("sends several held withdrawals to the payments list", async () => {
    const listHistory = async () => ({ items: [withdrawal({ status: "PROCESSING" }), withdrawal({ reference: "WDR000556", status: "PENDING", amount: 100_000 })], page: 1, pageSize: 10, total: 2 });

    renderMoney({ route: "/wallet", element: <WalletPage />, dataSource: dataSource(), services: fakeAccountServices({ payments: { listHistory }, limits }) });

    const banner = await screen.findByTestId("pending-withdrawal-banner");

    expect(banner).toHaveTextContent(`2 withdrawals totalling ${formatMoney(600_000)} are being processed.`);
    expect(within(banner).getByRole("link", { name: "View withdrawals" })).toHaveAttribute("href", "/payments?direction=withdrawal");
  });

  it("shows nothing when no withdrawal is open", async () => {
    const listHistory = async () => ({ items: [withdrawal({ status: "CONFIRMED" }), payment({ status: "PENDING" })], page: 1, pageSize: 10, total: 2 });

    renderMoney({ route: "/wallet", element: <WalletPage />, dataSource: dataSource(), services: fakeAccountServices({ payments: { listHistory }, limits }) });

    expect(await screen.findByTestId("wallet-available")).toBeInTheDocument();
    await screen.findByRole("link", { name: /DEP000123/ });
    expect(screen.queryByTestId("pending-withdrawal-banner")).not.toBeInTheDocument();
  });
});

describe("verification guidance on withdrawal", () => {
  it("links to verification when the platform answers KYC_REQUIRED", async () => {
    const user = userEvent.setup();
    const quoteWithdrawal = vi.fn(async (): Promise<WithdrawalQuote> => {
      throw new DataSourceError("KYC_REQUIRED", "Verify your identity before withdrawing.");
    });

    renderMoney({
      route: "/withdraw",
      element: <WithdrawFlow pollDelaysMs={[60_000]} />,
      services: fakeAccountServices({ payments: { listBankAccounts: async () => [ACCOUNT], quoteWithdrawal }, kyc: { getOverview: async () => ({ ...UNVERIFIED, status: "VERIFIED" }) } }),
    });

    await user.type(await screen.findByLabelText("Amount"), "1000");
    expect(screen.queryByRole("link", { name: "Verify your identity" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Review withdrawal" }));

    expect(await screen.findByRole("link", { name: "Verify your identity" })).toHaveAttribute("href", "/kyc");
    expect(screen.queryByTestId("kyc-status-notice")).not.toBeInTheDocument();
  });

  it("tells an unverified customer up front without blocking the form", async () => {
    renderMoney({
      route: "/withdraw",
      element: <WithdrawFlow pollDelaysMs={[60_000]} />,
      services: fakeAccountServices({ payments: { listBankAccounts: async () => [ACCOUNT] }, kyc: { getOverview: async () => UNVERIFIED } }),
    });

    const notice = await screen.findByTestId("kyc-status-notice");

    expect(notice).toHaveTextContent("You have not verified your identity yet.");
    expect(within(notice).getByRole("link", { name: "Go to verification" })).toHaveAttribute("href", "/kyc");
    expect(screen.getByRole("button", { name: "Review withdrawal" })).toBeEnabled();
  });
});

describe("limit cooling-off countdown", () => {
  function pendingSummary(effectiveInMs: number): LimitsSummary {
    return {
      limits: [
        { kind: "deposit_weekly", status: "pending", value: 1_000_000, effectiveAt: "2026-09-01T00:00:00.000Z", pendingValue: 2_000_000, pendingEffectiveAt: new Date(Date.now() + effectiveInMs).toISOString() },
      ],
      selfExclusion: { active: false },
      restricted: false,
    };
  }

  it("counts down on the limit and in the quieter banner", async () => {
    const summary = pendingSummary((23 * 60 + 14) * 60_000 + 30_000);

    renderMoney({ route: "/responsible-gaming", services: fakeAccountServices({ limits: { getSummary: async () => summary, listHistory: async () => [] } }) });

    expect(await screen.findByTestId("limit-deposit_weekly-pending")).toHaveTextContent("(in 23h 14m)");
    expect(screen.queryByTestId("limit-pending-banner")).not.toBeInTheDocument();
  });

  it("shows the change is taking effect and re-reads the limits once the time passes", async () => {
    const summary = pendingSummary(1_200);
    const getSummary = vi.fn(async () => summary);
    const listHistory = async () => ({ items: [], page: 1, pageSize: 10, total: 0 });

    renderMoney({
      route: "/wallet",
      element: <WalletPage />,
      dataSource: fakeDataSource({ getWallet: async () => wallet(500_000), queryTransactions: async (q) => ({ items: [], page: q.page ?? 1, pageSize: q.pageSize ?? 8, total: 0 }), subscribeAccount: () => () => undefined }),
      services: fakeAccountServices({ payments: { listHistory }, limits: { getSummary } }),
    });

    const banner = await screen.findByTestId("limit-pending-banner");

    expect(banner).toHaveTextContent(/Your weekly deposit limit change takes effect in 00:0\d/);
    expect(within(banner).getByRole("link", { name: "Your limits" })).toHaveAttribute("href", "/responsible-gaming");

    await waitFor(
      () => {
        expect(getSummary.mock.calls.length).toBeGreaterThan(1);
      },
      { timeout: 4_000 },
    );
  });
});

describe("account deletion blockers", () => {
  it("lists what must be resolved and holds the request until it is", async () => {
    const user = userEvent.setup();
    const deletion: AccountDeletion = { status: "NONE", cancellable: false, blockers: ["You have 2 open bets.", "A withdrawal is still processing."] };
    const requestDeletion = vi.fn(async () => deletion);

    renderMoney({
      route: "/account/delete",
      element: <AccountDeletionPage />,
      flags: { accountDeletionEnabled: true },
      services: fakeAccountServices({ security: { getDeletion: async () => deletion, requestDeletion } }),
    });

    const blockers = await screen.findByTestId("deletion-blockers");

    expect(within(blockers).getByRole("heading", { name: "Resolve these first" })).toBeInTheDocument();
    expect(within(blockers).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["You have 2 open bets.", "A withdrawal is still processing."]);
    expect(screen.getByRole("heading", { name: "What will be deleted" })).toBeInTheDocument();

    await user.type(screen.getByLabelText("Password"), "correct horse");

    expect(screen.getByRole("button", { name: "Request deletion" })).toBeDisabled();
    expect(requestDeletion).not.toHaveBeenCalled();
  });

  it("allows the request once the platform reports no blockers", async () => {
    const user = userEvent.setup();

    renderMoney({
      route: "/account/delete",
      element: <AccountDeletionPage />,
      flags: { accountDeletionEnabled: true },
      services: fakeAccountServices({ security: { getDeletion: async () => ({ status: "NONE", cancellable: false, blockers: [] }) } }),
    });

    const submit = await screen.findByRole("button", { name: "Request deletion" });

    expect(submit).toBeDisabled();
    await user.type(screen.getByLabelText("Password"), "correct horse");
    expect(submit).toBeEnabled();
    expect(screen.queryByTestId("deletion-blockers")).not.toBeInTheDocument();
  });
});
