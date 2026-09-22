import "@testing-library/jest-dom/vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { KycDocument, KycOverview, LimitsSummary, SelfExcludeRequest, StatementJob } from "@betng/contracts";
import { DataSourceError, formatMoney, type KycUploadInput } from "@betng/ui-core";
import { safeDownloadUrl } from "../../src/features/statements/statementMeta";
import { fakeAccountServices, notImplemented, renderMoney, resetClientState } from "./helpers";

beforeEach(() => {
  resetClientState();
});

const OVERVIEW: KycOverview = {
  status: "NOT_STARTED",
  tier: "TIER_0",
  requirements: [
    { check: "BVN", status: "NOT_STARTED" },
    { check: "NIN", status: "NOT_STARTED" },
    { check: "DOCUMENT", status: "NOT_STARTED" },
  ],
  limits: { dailyDeposit: 5_000_000 },
};

function kycServices(uploadDocument: (input: KycUploadInput) => Promise<KycDocument>) {
  return fakeAccountServices({ kyc: { getOverview: async () => OVERVIEW, listDocuments: async () => [], uploadDocument } });
}

describe("kyc", () => {
  it("shows the platform's status, tier and limits", async () => {
    renderMoney({ route: "/kyc", services: kycServices(vi.fn()) });

    expect(await screen.findByText("Tier 0")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Verification requirements" })).toHaveTextContent("Bank Verification Number");
    expect(screen.getByText(formatMoney(5_000_000))).toBeInTheDocument();
  });

  it("rejects the wrong type and an oversized file before any request", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const uploadDocument = vi.fn();

    renderMoney({ route: "/kyc", services: kycServices(uploadDocument) });

    const input = await screen.findByLabelText("Choose a file");

    await user.upload(input, new File(["hello"], "notes.txt", { type: "text/plain" }));
    expect(await screen.findByText("Upload a JPEG, PNG or PDF file.")).toBeInTheDocument();

    const big = new File(["x"], "scan.pdf", { type: "application/pdf" });

    Object.defineProperty(big, "size", { value: 11 * 1024 * 1024 });
    await user.upload(input, big);
    expect(await screen.findByText(/The file must be 10\.0 MB or smaller/)).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Upload document" })).toBeDisabled();
    expect(uploadDocument).not.toHaveBeenCalled();
  });

  it("shows upload progress, and a cancelled upload can be retried", async () => {
    const user = userEvent.setup();
    let release: (() => void) | undefined;
    const uploadDocument = vi.fn(
      (input: KycUploadInput) =>
        new Promise<KycDocument>((resolve, reject) => {
          input.onProgress?.({ loaded: 50, total: 100 });
          input.signal?.addEventListener("abort", () => {
            reject(new DataSourceError("CONFLICT", "aborted"));
          });
          release = () => {
            resolve({ id: "DOC1", type: input.type, status: "PENDING", fileName: input.file.name, sizeBytes: input.file.size, uploadedAt: "2026-09-21T10:00:00.000Z" });
          };
        }),
    );

    renderMoney({ route: "/kyc", services: kycServices(uploadDocument) });

    await user.upload(await screen.findByLabelText("Choose a file"), new File(["id"], "id-card.png", { type: "image/png" }));
    await user.click(screen.getByRole("button", { name: "Upload document" }));

    expect(await screen.findByRole("progressbar", { name: "Upload progress" })).toHaveAttribute("aria-valuenow", "50");
    expect(screen.getByText("Uploading… 50%")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel upload" }));
    expect(await screen.findByText("Upload cancelled. Nothing was submitted.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry upload" }));
    await waitFor(() => {
      expect(uploadDocument).toHaveBeenCalledTimes(2);
    });
    release?.();

    expect(await screen.findByText(/Document received/)).toBeInTheDocument();
    expect(window.localStorage.length + window.sessionStorage.length).toBe(0);
  });

  it("sends the BVN once, clears it and keeps it out of storage", async () => {
    const user = userEvent.setup();
    const verifyBvn = vi.fn(async () => ({ check: "BVN" as const, status: "VERIFIED" as const }));

    renderMoney({ route: "/kyc", services: fakeAccountServices({ kyc: { getOverview: async () => OVERVIEW, listDocuments: async () => [], verifyBvn } }) });

    const form = await screen.findByRole("form", { name: "Verify BVN" });

    await user.type(within(form).getByLabelText("BVN"), "22212345678");
    await user.type(within(form).getByLabelText("Date of birth"), "1990-04-12");
    await user.click(within(form).getByRole("button", { name: "Verify BVN" }));

    await waitFor(() => {
      expect(verifyBvn).toHaveBeenCalledWith({ bvn: "22212345678", dateOfBirth: "1990-04-12" });
    });
    expect(await within(form).findByText("Verified")).toBeInTheDocument();
    expect(within(form).getByLabelText("BVN")).toHaveValue("");
    expect(JSON.stringify({ ...window.localStorage, ...window.sessionStorage })).not.toContain("22212345678");
  });
});

function summary(overrides: Partial<LimitsSummary> = {}): LimitsSummary {
  return {
    limits: [
      { kind: "deposit_daily", status: "active", value: 500_000, used: 100_000, resetsAt: "2026-09-22T00:00:00.000Z", effectiveAt: "2026-09-01T00:00:00.000Z" },
      { kind: "deposit_weekly", status: "pending", value: 1_000_000, effectiveAt: "2026-09-01T00:00:00.000Z", pendingValue: 2_000_000, pendingEffectiveAt: "2026-09-22T10:00:00.000Z" },
    ],
    selfExclusion: { active: false },
    restricted: false,
    ...overrides,
  };
}

describe("responsible gaming", () => {
  it("tells active limits apart from pending changes", async () => {
    renderMoney({ route: "/responsible-gaming", services: fakeAccountServices({ limits: { getSummary: async () => summary(), listHistory: async () => [] } }) });

    const daily = await screen.findByTestId("limit-deposit_daily");
    const weekly = screen.getByTestId("limit-deposit_weekly");

    expect(within(daily).getByText("Active")).toBeInTheDocument();
    expect(within(daily).queryByText(/Takes effect on/)).not.toBeInTheDocument();
    expect(within(daily).getByText(/Resets/)).toBeInTheDocument();
    expect(within(weekly).getByText("Pending")).toBeInTheDocument();
    expect(within(weekly).getByTestId("limit-deposit_weekly-pending")).toHaveTextContent(`Changing to ${formatMoney(2_000_000)}. Takes effect on`);
    expect(within(weekly).getByText(formatMoney(1_000_000))).toBeInTheDocument();
    expect(within(screen.getByTestId("limit-loss_daily")).getByText("No limit set")).toBeInTheDocument();
  });

  it("asks for confirmation and the password before self-excluding", async () => {
    const user = userEvent.setup();
    const selfExclude = vi.fn(async (request: SelfExcludeRequest) => ({ active: true, period: request.period, startedAt: "2026-09-21T10:00:00.000Z", endsAt: "2026-09-28T10:00:00.000Z" }));

    renderMoney({ route: "/responsible-gaming", services: fakeAccountServices({ limits: { getSummary: async () => summary(), listHistory: async () => [], selfExclude } }) });

    await user.click(await screen.findByRole("radio", { name: /7 days/ }));
    await user.click(screen.getByRole("button", { name: "Self-exclude" }));

    const dialog = await screen.findByRole("dialog", { name: "Confirm self-exclusion" });
    const confirm = within(dialog).getByRole("button", { name: "Self-exclude" });

    expect(confirm).toBeDisabled();
    await user.click(within(dialog).getByRole("checkbox", { name: /cannot be reversed early/ }));
    await user.click(confirm);
    expect(await within(dialog).findByText("Enter your password to confirm.")).toBeInTheDocument();
    expect(selfExclude).not.toHaveBeenCalled();

    await user.type(within(dialog).getByLabelText("Password"), "correct horse");
    await user.click(confirm);

    await waitFor(() => {
      expect(selfExclude).toHaveBeenCalledWith({ period: "7d", password: "correct horse" });
    });
  });

  it("shows the restricted banner when the platform says so", async () => {
    renderMoney({
      route: "/responsible-gaming",
      services: fakeAccountServices({ limits: { getSummary: async () => summary({ restricted: true, selfExclusion: { active: true, period: "7d", endsAt: "2026-09-28T10:00:00.000Z" } }), listHistory: async () => [] } }),
    });

    expect(await screen.findByText("Your account is restricted.")).toBeInTheDocument();
  });

  it("renders Unavailable when the platform does not serve limits yet", async () => {
    renderMoney({ route: "/responsible-gaming", services: fakeAccountServices({ limits: { getSummary: async () => Promise.reject(notImplemented()), listHistory: async () => [] } }) });

    expect(await screen.findByText("Not available yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to account" })).toHaveAttribute("href", "/account");
  });
});

describe("feature flags and platform availability", () => {
  it.each([
    ["/wallet/deposit", { paymentsEnabled: false }, "Deposits are not available yet"],
    ["/wallet/withdraw", { paymentsEnabled: false }, "Withdrawals are not available yet"],
    ["/payments", { paymentsEnabled: false }, "Payments are not available yet"],
    ["/kyc", { kycEnabled: false }, "Verification is not available yet"],
    ["/responsible-gaming", { responsibleGamingEnabled: false }, "Limits are not available yet"],
    ["/statements", { statementsEnabled: false }, "Statements are not available yet"],
  ])("%s renders Unavailable when its flag is off", async (route, flags, title) => {
    renderMoney({ route, flags, services: fakeAccountServices() });

    expect(await screen.findByText(title)).toBeInTheDocument();
  });

  it("renders Unavailable for payments the platform does not serve", async () => {
    renderMoney({ route: "/payments", services: fakeAccountServices({ payments: { listHistory: async () => Promise.reject(notImplemented()) } }) });

    expect(await screen.findByText("Not available yet")).toBeInTheDocument();
  });

  it("shows Too many requests with seconds on a rate-limited page", async () => {
    renderMoney({
      route: "/payments",
      services: fakeAccountServices({ payments: { listHistory: async () => Promise.reject(new DataSourceError("RATE_LIMITED", "slow", { retryAfterSeconds: 12, requestId: "req-9" })) } }),
    });

    expect(await screen.findByText("Too many requests")).toBeInTheDocument();
    expect(screen.getByText(/Wait 12 seconds before trying again/)).toBeInTheDocument();
    expect(screen.getByText("req-9")).toBeInTheDocument();
  });

  it("reads payment history filters from the URL and asks the platform for that page", async () => {
    const listHistory = vi.fn(async () => ({ items: [], page: 2, pageSize: 20, total: 0 }));

    renderMoney({ route: "/payments?direction=withdrawal&status=failed&page=2", services: fakeAccountServices({ payments: { listHistory } }) });

    expect(await screen.findByText("No payments match these filters")).toBeInTheDocument();
    expect(listHistory).toHaveBeenCalledWith({ page: 2, pageSize: 20, direction: "WITHDRAWAL", status: "FAILED" });
  });
});

describe("statements", () => {
  it("polls the job and offers only a verified download link", async () => {
    const user = userEvent.setup();
    const job: StatementJob = { id: "STM1", status: "QUEUED", format: "CSV", from: "2026-09-01", to: "2026-09-20", createdAt: "2026-09-21T10:00:00.000Z" };
    const getStatement = vi
      .fn<(id: string) => Promise<StatementJob>>()
      .mockResolvedValueOnce(job)
      .mockResolvedValue({ ...job, status: "READY", downloadUrl: "https://evil.example/statement.csv" });

    renderMoney({ route: "/statements", services: fakeAccountServices({ security: { createStatement: async () => job, getStatement } }) });

    await user.click(await screen.findByRole("radio", { name: /CSV/ }));
    await user.click(screen.getByRole("button", { name: "Request statement" }));

    expect(await screen.findByText("Preparing")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Check status" }));

    expect(await screen.findByText(/download link could not be verified/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Download/ })).not.toBeInTheDocument();
  });

  it("accepts the API origin or an allowlisted https host only", () => {
    expect(safeDownloadUrl("https://api.betng.test/statements/1.pdf?sig=x", "https://api.betng.test", [])).toBe("https://api.betng.test/statements/1.pdf?sig=x");
    expect(safeDownloadUrl("https://files.betng-cdn.test/s.pdf", "https://api.betng.test", ["files.betng-cdn.test"])).toBe("https://files.betng-cdn.test/s.pdf");
    expect(safeDownloadUrl("http://files.betng-cdn.test/s.pdf", "https://api.betng.test", ["files.betng-cdn.test"])).toBeUndefined();
    expect(safeDownloadUrl("javascript:alert(1)", "https://api.betng.test", [])).toBeUndefined();
    expect(safeDownloadUrl("https://user:pw@api.betng.test/s.pdf", "https://api.betng.test", [])).toBeUndefined();
  });
});
