import "@testing-library/jest-dom/vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { Footer } from "../../src/layouts/shell/Footer";
import { SearchDialog, useSearchDialog } from "../../src/features/search";
import { resetClientState } from "../helpers/account";
import { renderApp } from "../helpers/runtime";
import { renderSecurity } from "../helpers/security";

const LEGAL = [
  ["Terms", "/legal/terms", "Terms of use"],
  ["Privacy", "/legal/privacy", "Privacy notice"],
  ["Responsible Gaming", "/legal/responsible-gaming", "Responsible gaming"],
  ["AML/KYC", "/legal/aml-kyc", "AML and KYC policy"],
  ["Cookies", "/legal/cookies", "Cookie policy"],
  ["Complaints", "/legal/complaints", "Complaints"],
] as const;

beforeEach(() => {
  resetClientState();
  useSearchDialog.setState({ open: false });
});

describe("Footer", () => {
  it("groups links and carries every legal link with the age note", () => {
    renderApp(<Footer />);

    for (const title of ["Football", "Platform", "Company", "Support"]) expect(screen.getByRole("navigation", { name: title })).toBeInTheDocument();

    const legal = screen.getByRole("navigation", { name: "Legal" });

    for (const [label, href] of LEGAL) expect(within(legal).getByRole("link", { name: label })).toHaveAttribute("href", href);
    expect(screen.getByLabelText("Adults only, 18 and over")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Home" })).not.toBeInTheDocument();
  });
});

describe("legal pages", () => {
  for (const [, href, title] of LEGAL) {
    it(`${href} shows the placeholder notice and is not indexed`, async () => {
      renderSecurity({ route: href });

      expect(await screen.findByRole("heading", { level: 1, name: title })).toBeInTheDocument();
      expect(screen.getByText("Placeholder — pending approved legal text.")).toBeInTheDocument();
      expect(document.querySelector('meta[name="robots"]')?.getAttribute("content")).toMatch(/noindex/);
    });
  }
});

describe("search shortcut", () => {
  it("opens on / but not while typing in a field", () => {
    renderApp(
      <>
        <input aria-label="Stake" />
        <SearchDialog />
      </>,
    );

    fireEvent.keyDown(screen.getByLabelText("Stake"), { key: "/" });
    expect(useSearchDialog.getState().open).toBe(false);

    fireEvent.keyDown(document.body, { key: "/" });
    expect(useSearchDialog.getState().open).toBe(true);
  });
});

describe("account navigation", () => {
  it("shows money links only when their flags are on", async () => {
    renderSecurity({ route: "/account/profile", flags: { paymentsEnabled: false, kycEnabled: true, statementsEnabled: false, responsibleGamingEnabled: true } });

    const nav = await screen.findByRole("navigation", { name: "Account sections" });

    expect(within(nav).getByRole("link", { name: "Verification" })).toHaveAttribute("href", "/kyc");
    expect(within(nav).getByRole("link", { name: "Responsible gaming" })).toHaveAttribute("href", "/responsible-gaming");
    expect(within(nav).queryByRole("link", { name: "Payments" })).not.toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "Statements" })).not.toBeInTheDocument();
    for (const name of ["Security", "Sessions", "Notifications", "Delete account"]) expect(within(nav).getByRole("link", { name })).toBeInTheDocument();
  });
});
