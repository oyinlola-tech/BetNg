import "@testing-library/jest-dom/vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AccountDeletion, AccountSession } from "@betng/contracts";
import { DataSourceError } from "@betng/ui-core";
import { ThemeProvider, ToastProvider } from "@betng/ui-web";
import { SessionGuard } from "../../src/features/auth";
import { clearPrivateQueries } from "../../src/lib/queryClient";
import { __setRuntimeForTests } from "../../src/services/runtime";
import { fakeDataSource, resetClientState, testSession } from "../helpers/account";
import { fakeAccountServices, fullAuthSource, renderSecurity } from "../helpers/security";

const URI = "otpauth://totp/BETNG:ada%40example.test?secret=JBSWY3DPEHPK3PXP&issuer=BETNG";
const KEY = "JBSW Y3DP EHPK 3PXP";
const CODES = ["AAAA-1111", "BBBB-2222", "CCCC-3333"];

beforeEach(() => {
  resetClientState();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("two-step setup", () => {
  it("shows the backup codes once and forgets the key and codes afterwards", async () => {
    const user = userEvent.setup();
    let enabled = false;
    const accountServices = fakeAccountServices({
      security: {
        changePassword: async () => undefined,
        getTwoFactor: async () => (enabled ? { enabled: true, required: false, method: "TOTP", backupCodesRemaining: 3 } : { enabled: false, required: false }),
        startTwoFactorEnrollment: async () => ({ enrollmentId: "enr-1", otpauthUri: URI, manualKey: KEY, expiresAt: new Date(Date.now() + 600_000).toISOString() }),
        confirmTwoFactor: vi.fn(async () => {
          enabled = true;

          return { codes: CODES, generatedAt: new Date().toISOString() };
        }),
      },
    });

    renderSecurity({ route: "/account/security", accountServices });

    await user.click(await screen.findByRole("button", { name: "Set up" }));
    await user.click(screen.getByRole("button", { name: "Start setup" }));

    expect(await screen.findByRole("img", { name: "QR code for your authenticator app" })).toBeInTheDocument();
    expect(screen.getByTestId("manual-key")).toHaveTextContent(KEY);
    expect(document.body.innerHTML).not.toContain("otpauth://");

    await user.type(screen.getByLabelText("Code from your app"), "246810");

    const list = await screen.findByRole("list", { name: "Backup codes" });

    expect(within(list).getAllByRole("listitem").map((item) => item.textContent)).toEqual(CODES);
    expect(screen.queryByTestId("manual-key")).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /QR code/ })).not.toBeInTheDocument();

    const done = screen.getByRole("button", { name: "Done" });

    expect(done).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: "I have saved these codes somewhere safe" }));
    await user.click(done);

    await waitFor(() => {
      expect(screen.queryByRole("list", { name: "Backup codes" })).not.toBeInTheDocument();
    });
    expect(document.body.textContent).not.toContain("AAAA-1111");
    expect(document.body.textContent).not.toContain(KEY);
    expect(await screen.findByText("On")).toBeInTheDocument();
    expect(JSON.stringify({ ...window.localStorage, ...window.sessionStorage })).not.toMatch(/AAAA-1111|JBSWY3DP/);
  });

  it("keeps a clear unavailable state when the flag is off", async () => {
    renderSecurity({ route: "/account/security", flags: { twoFactorEnabled: false } });

    expect(await screen.findByText("Two-step verification is not offered by the platform yet. It will appear here when it is.")).toBeInTheDocument();
  });
});

describe("signed-in devices", () => {
  const rows: AccountSession[] = [
    { id: "s-current", current: true, device: "Laptop", browser: "Firefox", createdAt: "2026-09-20T10:00:00.000Z", lastActiveAt: "2026-09-21T10:00:00.000Z", expiresAt: "2026-09-22T10:00:00.000Z" },
    { id: "s-phone", current: false, device: "Pixel 8", browser: "BETNG app", platform: "Android", location: "Lagos, NG", createdAt: "2026-09-18T10:00:00.000Z", lastActiveAt: "2026-09-21T08:00:00.000Z", expiresAt: "2026-09-23T10:00:00.000Z" },
  ];

  it("asks for confirmation before signing out another device", async () => {
    const user = userEvent.setup();
    const revokeSession = vi.fn(async () => undefined);
    const accountServices = fakeAccountServices({ security: { listSessions: async () => rows, revokeSession }, devices: { listPushDevices: async () => [] } });

    renderSecurity({ route: "/account/sessions", accountServices });

    expect(await screen.findByText("This device")).toBeInTheDocument();
    expect(screen.getByText(/Lagos, NG/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Sign out Pixel 8 · BETNG app" }));
    expect(revokeSession).not.toHaveBeenCalled();

    const dialog = await screen.findByRole("dialog", { name: "Sign out this device?" });

    await user.click(within(dialog).getByRole("button", { name: "Sign out device" }));
    await waitFor(() => {
      expect(revokeSession).toHaveBeenCalledWith("s-phone");
    });
    expect(screen.getByText("Browser notifications are not set up for this site. Devices registered from the BETNG app are listed below.")).toBeInTheDocument();
  });
});

describe("account deletion", () => {
  it("never says the account is deleted until the platform reports COMPLETED", async () => {
    const user = userEvent.setup();
    let state: AccountDeletion = { status: "NONE", cancellable: false };
    const keys: string[] = [];
    const requestDeletion = vi
      .fn(async (_request: unknown, key: string) => {
        keys.push(key);

        return state;
      })
      .mockImplementationOnce(async (_request: unknown, key: string) => {
        keys.push(key);
        throw new DataSourceError("NETWORK", "offline");
      })
      .mockImplementationOnce(async (_request: unknown, key: string) => {
        keys.push(key);
        state = { status: "PENDING", cancellable: true, scheduledFor: "2026-10-05T10:00:00.000Z", blockers: ["A payment is still processing."] };

        return state;
      });
    const accountServices = fakeAccountServices({ security: { getDeletion: async () => state, requestDeletion } });
    const { authSource } = renderSecurity({ route: "/account/delete", accountServices });

    await user.type(await screen.findByLabelText("Password"), "correct horse");
    await user.click(screen.getByRole("button", { name: "Request deletion" }));

    let dialog = await screen.findByRole("dialog", { name: "Delete your account?" });
    const confirm = within(dialog).getByRole("button", { name: "Delete account" });

    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText("Type DELETE to confirm"), "DELETE");
    await user.click(confirm);

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText(/has been deleted/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Request deletion" }));
    dialog = await screen.findByRole("dialog", { name: "Delete your account?" });
    await user.type(within(dialog).getByLabelText("Type DELETE to confirm"), "DELETE");
    await user.click(within(dialog).getByRole("button", { name: "Delete account" }));

    expect(await screen.findByText("Deletion requested")).toBeInTheDocument();
    expect(screen.getByText("A payment is still processing.")).toBeInTheDocument();
    expect(screen.getByText(/Your account is still open/)).toBeInTheDocument();
    expect(screen.queryByText(/has been deleted/)).not.toBeInTheDocument();
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
    expect(authSource.session.snapshot().status).toBe("AUTHENTICATED");
  });

  it("shows the completed state only from the platform", async () => {
    const accountServices = fakeAccountServices({ security: { getDeletion: async () => ({ status: "COMPLETED", cancellable: false }) } });

    renderSecurity({ route: "/account/delete", accountServices });

    expect(await screen.findByText("Your account has been deleted")).toBeInTheDocument();
  });
});

describe("session timeout and private data", () => {
  function mountGuard(expiresInMs: number, refreshSession: () => Promise<{ expiresAt: string }>) {
    const authSource = fullAuthSource({ signedIn: true, session: { ...testSession(), expiresAt: new Date(Date.now() + expiresInMs).toISOString() } });

    __setRuntimeForTests({ dataSource: fakeDataSource(), authSource, accountServices: fakeAccountServices({ security: { refreshSession } }) });

    const queryClient = new QueryClient();

    render(
      <MemoryRouter>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <ToastProvider>
              <SessionGuard />
            </ToastProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    return { authSource, queryClient };
  }

  it("warns in the last two minutes and extends the session through the platform", async () => {
    const user = userEvent.setup();
    const refreshSession = vi.fn(async () => {
      const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString();
      const current = authSource.session.snapshot().session;

      if (current !== undefined) authSource.session.set({ ...current, expiresAt });

      return { expiresAt };
    });
    const { authSource } = mountGuard(90_000, refreshSession);

    const dialog = await screen.findByRole("dialog", { name: "Your session is about to end" });

    await user.click(within(dialog).getByRole("button", { name: "Stay signed in" }));

    expect(refreshSession).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Your session is about to end" })).not.toBeInTheDocument();
    });
  });

  it("stays quiet while more than two minutes remain", async () => {
    mountGuard(10 * 60_000, vi.fn());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(screen.queryByRole("dialog", { name: "Your session is about to end" })).not.toBeInTheDocument();
  });

  it("tells the customer to sign in again when the platform cannot extend it", async () => {
    const user = userEvent.setup();

    mountGuard(60_000, async () => {
      throw new DataSourceError("NOT_IMPLEMENTED", "not served");
    });

    const dialog = await screen.findByRole("dialog", { name: "Your session is about to end" });

    await user.click(within(dialog).getByRole("button", { name: "Stay signed in" }));
    expect(await within(dialog).findByText(/cannot be extended from here/)).toBeInTheDocument();
  });

  it("drops private caches when the session expires, and keeps public ones", async () => {
    const { authSource, queryClient } = mountGuard(10 * 60_000, vi.fn());

    queryClient.setQueryData(["wallet"], { available: 1 });
    queryClient.setQueryData(["account", "sessions"], []);
    queryClient.setQueryData(["payments", "history"], []);
    queryClient.setQueryData(["kyc"], {});
    queryClient.setQueryData(["leagues"], []);

    act(() => {
      authSource.session.expire();
    });

    await waitFor(() => {
      expect(queryClient.getQueryData(["wallet"])).toBeUndefined();
    });
    expect(queryClient.getQueryData(["account", "sessions"])).toBeUndefined();
    expect(queryClient.getQueryData(["payments", "history"])).toBeUndefined();
    expect(queryClient.getQueryData(["kyc"])).toBeUndefined();
    expect(queryClient.getQueryData(["leagues"])).toEqual([]);
  });

  it("clears every private root on sign-out", () => {
    const queryClient = new QueryClient();

    for (const root of ["wallet", "transactions", "bets", "notifications", "account", "payments", "kyc", "limits", "statements"]) queryClient.setQueryData([root], 1);
    queryClient.setQueryData(["matches"], 1);

    clearPrivateQueries(queryClient);

    expect(queryClient.getQueryCache().getAll().map((query) => query.queryKey)).toEqual([["matches"]]);
  });
});
