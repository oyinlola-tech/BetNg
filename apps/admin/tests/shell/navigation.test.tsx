import { act, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderConsole } from "../helpers/render";
import { SUPPORT_PERMISSIONS } from "../helpers/sources";

describe("permission-based navigation", () => {
  it("shows a support admin only the areas their session grants", async () => {
    renderConsole({ permissions: SUPPORT_PERMISSIONS });

    const nav = await screen.findByRole("navigation", { name: "Primary" });

    expect(within(nav).getByRole("link", { name: "Users" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Audit Logs" })).toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "Risk" })).not.toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "Settings" })).not.toBeInTheDocument();
  });

  it("renders the forbidden state on a direct route without the read permission, and reads nothing", async () => {
    const { adminSource } = renderConsole({ path: "/risk", permissions: SUPPORT_PERMISSIONS });

    expect(await screen.findByText("Permission denied")).toBeInTheDocument();
    expect(screen.getByText(/risk:read/)).toBeInTheDocument();
    expect(adminSource.calls("getRiskOverview")).not.toHaveBeenCalled();
    expect(adminSource.calls("listExposure")).not.toHaveBeenCalled();
  });

  it("shows every area to an admin holding every permission", async () => {
    renderConsole();

    const nav = await screen.findByRole("navigation", { name: "Primary" });

    for (const name of ["Dashboard", "Users", "Shops", "Cashiers", "Leagues", "Teams", "Fixtures", "Matches", "Markets", "Odds", "Risk", "Live Control", "Simulation", "Settlement", "Wallet", "Reports", "Audit Logs", "System Health", "Settings"]) {
      expect(within(nav).getByRole("link", { name })).toBeInTheDocument();
    }
  });
});

describe("an expired session", () => {
  it("asks for sign-in again over the same route", async () => {
    const { adminSource, router } = renderConsole({ path: "/users?status=ACTIVE" });

    expect(await screen.findByRole("heading", { level: 1, name: "Users" })).toBeInTheDocument();

    act(() => {
      adminSource.session.expire();
    });

    expect(await screen.findByRole("dialog", { name: "Your session has ended" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Users" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/users");
    expect(router.state.location.search).toBe("?status=ACTIVE");
    expect(screen.getByLabelText(/Work email/)).toHaveValue("admin@example.test");
  });
});
