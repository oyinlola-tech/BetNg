import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DataSourceError } from "@betng/ui-core";
import { LoginPage } from "../../src/pages/LoginPage";
import { Providers, installSources } from "../helpers/render";
import { session, ALL_PERMISSIONS } from "../helpers/sources";

describe("admin sign-in", () => {
  it("asks for the second factor and signs in with the code", async () => {
    const user = userEvent.setup();
    const login = vi.fn((request: { readonly code?: string }) => (request.code === undefined ? Promise.reject(new DataSourceError("VALIDATION", "A code is required.")) : Promise.resolve(session(ALL_PERMISSIONS))));

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
    expect(login).toHaveBeenCalledTimes(1);
    expect(login).toHaveBeenLastCalledWith({ email: "admin@example.test", password: "correct horse" });

    await user.type(screen.getByLabelText("Authentication code"), "123456");

    await waitFor(() => {
      expect(login).toHaveBeenLastCalledWith({ email: "admin@example.test", password: "correct horse", code: "123456" });
    });
  });

  it("shows a refusal without the platform's wording and stays on the form", async () => {
    const user = userEvent.setup();

    installSources({ signedIn: false, admin: { login: () => Promise.reject(new DataSourceError("INVALID_CREDENTIALS", "internal: user row 42 mismatch")) } });
    render(
      <Providers>
        <LoginPage />
      </Providers>,
    );

    await user.type(screen.getByLabelText(/Work email/), "admin@example.test");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByLabelText(/Work email/)).toBeInTheDocument();
  });

  it("offers no development sign-ins unless the mock supplied them", () => {
    installSources({ signedIn: false });
    render(
      <Providers>
        <LoginPage />
      </Providers>,
    );

    expect(screen.queryByRole("region", { name: "Development sign-ins" })).not.toBeInTheDocument();
  });
});
