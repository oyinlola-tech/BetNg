import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DataSourceError } from "@betng/ui-core";
import { LoginPage } from "../../src/pages/LoginPage";
import { Providers, installSources, renderConsole } from "../helpers/render";
import { fixture, page } from "../helpers/rows";
import { ALL_PERMISSIONS, session } from "../helpers/sources";

const OUTCOME_CONTROL = /winner|set score|force/i;

const run = { id: "sim-0001", matchId: fixture.matchId, status: "FAILED", events: 0, score: null, seed: null, matchLabel: "Harbour Town v Ridge United", leagueName: "Test League", error: "Timed out" };
const settlement = { id: "stl-0001", betId: "bet-0001", owner: "user:Ada O.", channel: "ONLINE", matchLabel: "Harbour Town v Ridge United", result: "2-1", stake: 100_000, payout: 0, status: "FAILED", error: "Ledger write failed", timestamp: "2026-09-21T12:00:00.000Z" };
const ROWS: Readonly<Record<string, readonly unknown[]>> = { fixtures: [fixture], simulations: [run], settlements: [settlement] };

describe("mandatory two-step verification", () => {
  it("locks the console behind a notice for an operator without a second factor, and reads nothing", async () => {
    const { adminSource } = renderConsole({ path: "/users", twoFactorEnabled: false });

    expect(await screen.findByRole("alertdialog", { name: "Two-step verification required" })).toBeInTheDocument();
    expect(screen.getByText(/Pending backend/)).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Primary" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Continue on development data/ })).not.toBeInTheDocument();
    expect(adminSource.calls("queryList")).not.toHaveBeenCalled();
  });

  it("signs the operator out from the notice", async () => {
    const user = userEvent.setup();
    const { adminSource } = renderConsole({ twoFactorEnabled: false });

    await user.click(await screen.findByRole("button", { name: "Sign out" }));

    expect(adminSource.calls("logout")).toHaveBeenCalledTimes(1);
  });

  it("opens the console for an operator with a second factor", async () => {
    renderConsole({ path: "/users" });

    expect(await screen.findByRole("heading", { level: 1, name: "Users" })).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog", { name: "Two-step verification required" })).not.toBeInTheDocument();
  });
});

describe("session timeout", () => {
  it("warns before the platform session ends and says it cannot be extended here", async () => {
    const { adminSource } = renderConsole({ path: "/users" });

    await screen.findByRole("heading", { level: 1, name: "Users" });

    act(() => {
      adminSource.session.set({ ...session(ALL_PERMISSIONS), expiresAt: new Date(Date.now() + 60_000).toISOString() });
    });

    expect(await screen.findByRole("dialog", { name: "Your session is about to end" })).toBeInTheDocument();
    expect(screen.getByText(/cannot be extended from here/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Stay signed in" })).not.toBeInTheDocument();
  });
});

describe("second factor at sign-in", () => {
  it("prompts for the code when the platform answers TWO_FACTOR_REQUIRED", async () => {
    const user = userEvent.setup();
    const login = vi.fn((request: { readonly code?: string }) => (request.code === undefined ? Promise.reject(new DataSourceError("TWO_FACTOR_REQUIRED", "code needed")) : Promise.resolve(session(ALL_PERMISSIONS))));

    installSources({ signedIn: false, admin: { login } });
    render(
      <Providers>
        <LoginPage />
      </Providers>,
    );

    await user.type(screen.getByLabelText(/Work email/), "admin@example.test");
    await user.type(screen.getByLabelText("Password"), "correct horse");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { name: "Two-factor verification" })).toBeInTheDocument();
  });

  it("prompts for the code when a refusal names the code field", async () => {
    const user = userEvent.setup();
    const login = vi.fn(() => Promise.reject(new DataSourceError("INVALID_CREDENTIALS", "code required", { fields: { code: "Required" } })));

    installSources({ signedIn: false, admin: { login } });
    render(
      <Providers>
        <LoginPage />
      </Providers>,
    );

    await user.type(screen.getByLabelText(/Work email/), "admin@example.test");
    await user.type(screen.getByLabelText("Password"), "correct horse");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { name: "Two-factor verification" })).toBeInTheDocument();
  });

  it("lets the operator send the code with the first attempt", async () => {
    const user = userEvent.setup();
    const login = vi.fn(() => Promise.resolve(session(ALL_PERMISSIONS)));

    installSources({ signedIn: false, admin: { login } });
    render(
      <Providers>
        <LoginPage />
      </Providers>,
    );

    await user.type(screen.getByLabelText(/Work email/), "admin@example.test");
    await user.type(screen.getByLabelText("Password"), "correct horse");
    await user.click(screen.getByRole("button", { name: "Sign in with an authenticator code" }));
    await user.type(await screen.findByLabelText("Authentication code"), "246810");

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith({ email: "admin@example.test", password: "correct horse", code: "246810" });
    });
    expect(login).toHaveBeenCalledTimes(1);
  });
});

describe("no control changes an outcome", () => {
  it.each([`/matches/${fixture.matchId}`, "/live", "/simulation", "/settlement", "/fixtures", "/matches"])("%s has no winner, score or force control", async (path) => {
    renderConsole({ path, admin: { queryList: (resource: string) => Promise.resolve(page(ROWS[resource] ?? [])), getFixture: fixture } });

    await screen.findByRole("heading", { level: 1 }, { timeout: 5000 });
    await waitFor(() => {
      expect(document.querySelector("table[aria-busy='true']")).toBeNull();
    });

    const buttons = screen.queryAllByRole("button").map((button) => `${button.textContent} ${button.getAttribute("aria-label") ?? ""}`);

    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons.filter((label) => OUTCOME_CONTROL.test(label))).toEqual([]);
  });
});
