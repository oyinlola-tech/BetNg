import "@testing-library/jest-dom/vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataSourceError } from "@betng/ui-core";
import { useBetSlip } from "../../src/stores/betslip.store";
import { fakeAuthSource, fakeDataSource, renderAccount, resetClientState, slipSelection, testSession } from "../helpers/account";

beforeEach(() => {
  resetClientState();
});

describe("RequireAuth", () => {
  it("keeps a signed-out visitor on the route and reads nothing from the account", async () => {
    const getWallet = vi.fn();

    renderAccount({ route: "/wallet", signedIn: false, dataSource: fakeDataSource({ getWallet }) });

    expect(await screen.findByText("Sign in required")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/wallet");
    expect(screen.queryByRole("heading", { name: "Wallet" })).not.toBeInTheDocument();
    expect(getWallet).not.toHaveBeenCalled();
  });

  it("opens the page once the customer signs in from the gate", async () => {
    const user = userEvent.setup();

    renderAccount({ route: "/wallet", signedIn: false });

    await user.click(await screen.findByRole("button", { name: "Sign in" }));

    const dialog = await screen.findByRole("dialog", { name: "Sign in" });

    await user.type(within(dialog).getByLabelText("Email"), "ada@example.test");
    await user.type(within(dialog).getByLabelText("Password"), "correct horse");
    await user.click(within(dialog).getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { name: "Wallet" }, { timeout: 3000 })).toBeInTheDocument();
    expect(window.localStorage.getItem("betng.betslip") ?? "").not.toContain("correct horse");
    expect(JSON.stringify({ ...window.localStorage })).not.toContain("test-token");
  });

  it("leaves public pages alone", async () => {
    renderAccount({ route: "/settings", signedIn: false });

    expect(await screen.findByRole("heading", { name: "Settings" })).toBeInTheDocument();
  });
});

describe("session expiry", () => {
  it("keeps the route and the slip, and returns to the page after signing in again", async () => {
    const user = userEvent.setup();
    const authSource = fakeAuthSource({ signedIn: true });

    useBetSlip.setState({ selections: [slipSelection("m1")] });
    renderAccount({ route: "/transactions?status=completed", authSource });

    expect(await screen.findByRole("heading", { name: "Transactions" })).toBeInTheDocument();

    act(() => {
      authSource.session.expire();
    });

    const dialog = await screen.findByRole("dialog", { name: "Session ended" });

    expect(screen.getByText("Your session has ended")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/transactions?status=completed");
    expect(useBetSlip.getState().selections).toHaveLength(1);
    expect(within(dialog).getByLabelText("Email")).toHaveValue(testSession().user.email);

    await user.type(within(dialog).getByLabelText("Password"), "correct horse");
    await user.click(within(dialog).getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { name: "Transactions" }, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/transactions?status=completed");
  });
});

describe("sign-in form", () => {
  it("validates before calling the platform", async () => {
    const user = userEvent.setup();
    const authSource = fakeAuthSource();
    const login = vi.spyOn(authSource, "login");

    renderAccount({ route: "/login", authSource });

    await user.click(await screen.findByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByText("Enter your password.")).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it("presents rate limiting and wrong credentials without the server's text", async () => {
    const user = userEvent.setup();
    const authSource = fakeAuthSource();
    const login = vi
      .spyOn(authSource, "login")
      .mockRejectedValueOnce(new DataSourceError("RATE_LIMITED", "429 upstream throttle", { retryAfterSeconds: 30 }))
      .mockRejectedValueOnce(new DataSourceError("INVALID_CREDENTIALS", "bcrypt mismatch for user 17"));

    renderAccount({ route: "/login", authSource });

    await user.type(await screen.findByLabelText("Email"), "ada@example.test");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Too many attempts")).toBeInTheDocument();
    expect(screen.queryByText(/upstream throttle/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledTimes(2);
    });
    expect(screen.queryByText(/bcrypt/)).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("applies backend field errors to the registration form", async () => {
    const user = userEvent.setup();
    const authSource = fakeAuthSource();

    vi.spyOn(authSource, "register").mockRejectedValueOnce(new DataSourceError("VALIDATION", "invalid", { fields: { email: "This address cannot be used." } }));
    renderAccount({ route: "/register", authSource });

    await user.type(await screen.findByLabelText("Display name"), "Ada Obi");
    await user.type(screen.getByLabelText("Email"), "ada@example.test");
    await user.type(screen.getByLabelText("Password"), "long-enough-pass");
    await user.click(screen.getByRole("checkbox", { name: /18 or over/ }));
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("This address cannot be used.")).toBeInTheDocument();
  });

  it("sends a signed-in visitor to the page they came for", async () => {
    renderAccount({ route: "/login?next=/tickets" });

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/tickets");
    });
  });

  it("ignores an off-site return address", async () => {
    renderAccount({ route: "/login?next=//evil.example" });

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent(/^\/$/);
    });
  });
});

describe("sign-out", () => {
  it("drops the customer's cached data", async () => {
    const user = userEvent.setup();
    const { queryClient } = renderAccount({ route: "/account/sessions" });

    queryClient.setQueryData(["wallet"], { available: 1 });

    await user.click(await screen.findByRole("button", { name: "Sign out" }));

    await waitFor(() => {
      expect(queryClient.getQueryData(["wallet"])).toBeUndefined();
    });
    expect(screen.getByTestId("location")).toHaveTextContent(/^\/$/);
  });
});
