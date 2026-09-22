import "@testing-library/jest-dom/vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CustomerProfile, UpdateProfileRequest } from "@betng/contracts";
import { DataSourceError } from "@betng/ui-core";
import { TEST_USER, resetClientState } from "../helpers/account";
import { fakeAccountServices, fullAuthSource, renderSecurity } from "../helpers/security";

beforeEach(() => {
  resetClientState();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void } {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });

  return { promise, resolve, reject };
}

describe("profile editing", () => {
  it("saves only the changed fields and confirms after the platform answers", async () => {
    const user = userEvent.setup();
    const authSource = fullAuthSource({ signedIn: true });
    const pending = deferred<CustomerProfile>();
    const update = vi.fn(async (_request: UpdateProfileRequest) => {
      const saved = await pending.promise;
      const current = authSource.session.snapshot().session;

      if (current !== undefined) authSource.session.set({ ...current, user: saved });

      return saved;
    });

    renderSecurity({ route: "/account/profile", authSource, accountServices: fakeAccountServices({ profile: { update } }) });

    await user.click(await screen.findByRole("button", { name: "Edit profile" }));

    const email = screen.getByLabelText("Email");

    expect(email).toHaveAttribute("readonly");
    expect(screen.getAllByText(/changes through its own verified flow/).length).toBeGreaterThan(0);

    await user.clear(screen.getByLabelText("Display name"));
    await user.type(screen.getByLabelText("Display name"), "Ada O.");
    await user.type(screen.getByLabelText("Phone"), "+234 801 234 5678");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(update).toHaveBeenCalledWith({ displayName: "Ada O.", phone: "+234 801 234 5678" });
    expect(screen.queryByText("Profile updated")).not.toBeInTheDocument();

    pending.resolve({ ...TEST_USER, displayName: "Ada O.", phone: "+234 801 234 5678" });

    expect(await screen.findByText("Profile updated")).toBeInTheDocument();
    expect(await screen.findByLabelText("Display name")).toHaveValue("Ada O.");
    expect(screen.getByLabelText("Display name")).toHaveAttribute("readonly");
  });

  it("validates on blur before anything is sent", async () => {
    const user = userEvent.setup();
    const update = vi.fn();

    renderSecurity({ route: "/account/profile", accountServices: fakeAccountServices({ profile: { update } }) });

    await user.click(await screen.findByRole("button", { name: "Edit profile" }));
    await user.type(screen.getByLabelText("Phone"), "12");
    await user.tab();

    expect(await screen.findByText("Enter a phone number with its country code.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(update).not.toHaveBeenCalled();
  });

  it("puts the platform's field errors on the fields", async () => {
    const user = userEvent.setup();
    const update = vi.fn(async () => Promise.reject(new DataSourceError("VALIDATION", "Check the highlighted fields.", { fields: { displayName: "That name is taken." } })));

    renderSecurity({ route: "/account/profile", accountServices: fakeAccountServices({ profile: { update } }) });

    await user.click(await screen.findByRole("button", { name: "Edit profile" }));
    await user.clear(screen.getByLabelText("Display name"));
    await user.type(screen.getByLabelText("Display name"), "Taken Name");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("That name is taken.")).toBeInTheDocument();
    expect(screen.queryByText("Profile updated")).not.toBeInTheDocument();
  });

  it("shows an unavailable state when the platform does not serve the route", async () => {
    const user = userEvent.setup();
    const update = vi.fn(async () => Promise.reject(new DataSourceError("NOT_IMPLEMENTED", "Not served.")));

    renderSecurity({ route: "/account/profile", accountServices: fakeAccountServices({ profile: { update } }) });

    await user.click(await screen.findByRole("button", { name: "Edit profile" }));
    await user.clear(screen.getByLabelText("Display name"));
    await user.type(screen.getByLabelText("Display name"), "Another");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Profile editing is not available yet")).toBeInTheDocument();
    expect(screen.queryByText("Profile updated")).not.toBeInTheDocument();
  });
});

describe("data export", () => {
  it("downloads exactly what the platform returned", async () => {
    const user = userEvent.setup();
    const bundle = { profile: { id: TEST_USER.id } };
    const exportData = vi.fn(async () => bundle);
    const createObjectURL = vi.fn((_blob: Blob) => "blob:export");
    const revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    Object.assign(URL, { createObjectURL, revokeObjectURL });

    renderSecurity({ route: "/account/profile", accountServices: fakeAccountServices({ profile: { exportData } }) });

    await user.click(await screen.findByRole("button", { name: "Download my data" }));

    expect(await screen.findByText("Download ready")).toBeInTheDocument();
    expect(click).toHaveBeenCalledTimes(1);

    const blob = createObjectURL.mock.calls[0]?.[0];

    expect(blob?.type).toBe("application/json");
    expect(JSON.parse(await blob!.text())).toEqual(bundle);
    await waitFor(() => {
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:export");
    });
  });

  it("shows the export as unavailable on NOT_IMPLEMENTED, with no success message", async () => {
    const user = userEvent.setup();
    const exportData = vi.fn(async () => Promise.reject(new DataSourceError("NOT_IMPLEMENTED", "Not served.")));

    renderSecurity({ route: "/account/profile", accountServices: fakeAccountServices({ profile: { exportData } }) });

    await user.click(await screen.findByRole("button", { name: "Download my data" }));

    expect(await screen.findByText("Data download is not available yet")).toBeInTheDocument();
    expect(screen.queryByText("Download ready")).not.toBeInTheDocument();
  });
});
