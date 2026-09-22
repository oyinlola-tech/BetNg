import "@testing-library/jest-dom/vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataSourceError } from "@betng/ui-core";
import { resetClientState } from "../helpers/account";
import { fullAuthSource, renderSecurity } from "../helpers/security";

const CHALLENGE = { challengeId: "challenge-1", methods: ["TOTP", "BACKUP_CODE"] as const, expiresAt: new Date(Date.now() + 5 * 60_000).toISOString() };

function challenged() {
  const authSource = fullAuthSource();

  vi.spyOn(authSource, "login").mockRejectedValue(new DataSourceError("TWO_FACTOR_REQUIRED", "code needed", { challenge: { ...CHALLENGE, methods: [...CHALLENGE.methods] } }));

  return authSource;
}

async function signIn(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.type(await screen.findByLabelText("Email"), "ada@example.test");
  await user.type(screen.getByLabelText("Password"), "correct horse");
  await user.click(screen.getByRole("button", { name: "Sign in" }));
}

beforeEach(() => {
  resetClientState();
});

describe("sign-in with two-step verification", () => {
  it("answers the challenge with an authenticator code", async () => {
    const user = userEvent.setup();
    const authSource = challenged();
    const complete = vi.spyOn(authSource, "completeTwoFactor");

    renderSecurity({ route: "/login?next=/tickets", authSource });
    await signIn(user);

    expect(await screen.findByRole("heading", { name: "Two-step verification" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Authenticator code"), "246810");

    await waitFor(() => {
      expect(complete).toHaveBeenCalledWith({ challengeId: "challenge-1", code: "246810" });
    });
    await waitFor(
      () => {
        expect(screen.getByTestId("location")).toHaveTextContent("/tickets");
      },
      { timeout: 3000 },
    );
  });

  it("switches to a backup code", async () => {
    const user = userEvent.setup();
    const authSource = challenged();
    const complete = vi.spyOn(authSource, "completeTwoFactor");

    renderSecurity({ route: "/login", authSource });
    await signIn(user);

    await user.click(await screen.findByRole("button", { name: "Use a backup code instead" }));
    await user.type(screen.getByLabelText("Backup code"), "abcd-1234");
    await user.click(screen.getByRole("button", { name: "Verify and sign in" }));

    await waitFor(() => {
      expect(complete).toHaveBeenCalledWith({ challengeId: "challenge-1", code: "ABCD-1234" });
    });
  });

  it("asks to start again when the challenge has expired", async () => {
    const user = userEvent.setup();
    const authSource = challenged();

    vi.spyOn(authSource, "completeTwoFactor").mockRejectedValue(new DataSourceError("SESSION_EXPIRED", "expired"));
    renderSecurity({ route: "/login", authSource });
    await signIn(user);
    await user.type(await screen.findByLabelText("Authenticator code"), "111111");

    expect(await screen.findByText("This sign-in attempt has expired")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sign in again" }));
    expect(await screen.findByLabelText("Password")).toBeInTheDocument();
  });

  it("stops after too many attempts", async () => {
    const user = userEvent.setup();
    const authSource = challenged();

    vi.spyOn(authSource, "completeTwoFactor").mockRejectedValue(new DataSourceError("RATE_LIMITED", "429"));
    renderSecurity({ route: "/login", authSource });
    await signIn(user);
    await user.type(await screen.findByLabelText("Authenticator code"), "111111");

    expect(await screen.findByText("Too many attempts")).toBeInTheDocument();
  });
});

describe("return address after sign-in", () => {
  for (const next of ["//evil.com", "https://evil.com", "/\\evil.com"]) {
    it(`ignores ${next}`, async () => {
      const user = userEvent.setup();

      renderSecurity({ route: `/login?next=${encodeURIComponent(next)}`, authSource: fullAuthSource() });
      await signIn(user);

      await waitFor(
        () => {
          expect(screen.getByTestId("location")).toHaveTextContent(/^\/$/);
        },
        { timeout: 3000 },
      );
    });
  }
});

describe("password reset confirmation", () => {
  it("validates the code and the matching passwords before calling the platform", async () => {
    const user = userEvent.setup();
    const authSource = fullAuthSource();
    const confirm = vi.spyOn(authSource, "confirmPasswordReset");

    renderSecurity({ route: "/reset-password", authSource });

    await user.type(await screen.findByLabelText("Email"), "ada@example.test");
    await user.type(screen.getByLabelText("New password"), "a-long-new-pass");
    await user.type(screen.getByLabelText("Confirm new password"), "something-else");
    await user.click(screen.getByRole("button", { name: "Set new password" }));

    expect(await screen.findByText("Enter the 6-digit code.")).toBeInTheDocument();
    expect(screen.getByText("The passwords do not match.")).toBeInTheDocument();
    expect(confirm).not.toHaveBeenCalled();
  });

  it("warns when the platform reports a breached password, and confirms success", async () => {
    const user = userEvent.setup();
    const authSource = fullAuthSource();
    const confirm = vi
      .spyOn(authSource, "confirmPasswordReset")
      .mockRejectedValueOnce(new DataSourceError("VALIDATION", "invalid", { fields: { newPassword: "That password appears in known breaches. Choose another." } }))
      .mockResolvedValueOnce(undefined);

    renderSecurity({ route: "/reset-password", authSource });

    await user.type(await screen.findByLabelText("Email"), "ada@example.test");
    await user.type(screen.getByLabelText("Reset code"), "123456");
    await user.type(screen.getByLabelText("New password"), "password-2026");
    await user.type(screen.getByLabelText("Confirm new password"), "password-2026");
    expect(screen.getByText(/Strength:/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Set new password" }));

    expect(await screen.findByText("This password has appeared in a data breach.")).toBeInTheDocument();

    const fresh = screen.getByLabelText("New password");

    await user.clear(fresh);
    await user.type(fresh, "Quiet-Harbour-Lamp-71");
    await user.clear(screen.getByLabelText("Confirm new password"));
    await user.type(screen.getByLabelText("Confirm new password"), "Quiet-Harbour-Lamp-71");
    await user.click(screen.getByRole("button", { name: "Set new password" }));

    expect(await screen.findByText("Password updated")).toBeInTheDocument();
    expect(confirm).toHaveBeenLastCalledWith({ email: "ada@example.test", code: "123456", newPassword: "Quiet-Harbour-Lamp-71" });
    expect(within(document.body).queryByDisplayValue("Quiet-Harbour-Lamp-71")).not.toBeInTheDocument();
  });
});
