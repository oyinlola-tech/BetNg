import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DataSourceError } from "@betng/ui-core";
import { renderConsole } from "../helpers/render";
import { page } from "../helpers/rows";
import { SUPPORT_PERMISSIONS } from "../helpers/sources";

const NOW = "2026-09-21T12:00:00.000Z";
const ON = { complianceEnabled: true };

const kycItem = {
  userId: "11111111-1111-4111-8111-111111111111",
  displayName: "Ada Obi",
  email: "ada@example.test",
  status: "PENDING",
  tier: "TIER_1",
  submittedAt: NOW,
  documents: [{ id: "doc-0001", type: "NATIONAL_ID", status: "PENDING", fileName: "id-front.jpg", sizeBytes: 1_200_000, uploadedAt: NOW }],
};

const withdrawal = {
  reference: "WDR900004",
  direction: "WITHDRAWAL",
  status: "PENDING",
  amount: 500_000,
  fee: 2_500,
  netAmount: 497_500,
  currency: "NGN",
  provider: "PAYSTACK",
  createdAt: NOW,
  updatedAt: NOW,
  userId: "22222222-2222-4222-8222-222222222222",
  userEmail: "tunde@example.test",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("compliance navigation", () => {
  it("hides Payments, KYC and Responsible Gaming while the flag is off", async () => {
    renderConsole();

    const nav = await screen.findByRole("navigation", { name: "Primary" });

    expect(within(nav).getByRole("link", { name: "Users" })).toBeInTheDocument();
    for (const name of ["Payments", "KYC", "Responsible Gaming"]) expect(within(nav).queryByRole("link", { name })).not.toBeInTheDocument();
  });

  it("shows them with the flag on, each only with its permission", async () => {
    renderConsole({ flags: ON, permissions: SUPPORT_PERMISSIONS });

    const nav = await screen.findByRole("navigation", { name: "Primary" });

    expect(within(nav).getByRole("link", { name: "Responsible Gaming" })).toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "KYC" })).not.toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "Payments" })).not.toBeInTheDocument();
  });

  it("answers a direct link with Not available yet while the flag is off, and reads nothing", async () => {
    const { compliance } = renderConsole({ path: "/kyc" });

    expect(await screen.findByText("Not available yet")).toBeInTheDocument();
    expect(compliance.calls("listKycQueue")).not.toHaveBeenCalled();
  });

  it("forbids a direct link without the permission", async () => {
    const { compliance } = renderConsole({ path: "/payments", flags: ON, permissions: SUPPORT_PERMISSIONS });

    expect(await screen.findByText("Permission denied")).toBeInTheDocument();
    expect(compliance.calls("listPayments")).not.toHaveBeenCalled();
  });
});

describe("KYC review", () => {
  it("requires a reason and a confirmation, then calls reviewKyc once", async () => {
    const user = userEvent.setup();
    const { compliance } = renderConsole({ path: "/kyc", flags: ON, compliance: { listKycQueue: page([kycItem]), reviewKyc: { ...kycItem, status: "REJECTED" } } });
    const review = compliance.calls("reviewKyc");
    const table = await screen.findByRole("table", { name: "KYC review queue" });

    await user.click(await within(table).findByText("Ada Obi"));

    const drawer = await screen.findByRole("dialog", { name: "Ada Obi" });

    expect(within(drawer).getByText(/id-front\.jpg/)).toBeInTheDocument();

    await user.click(within(drawer).getByRole("button", { name: "Reject" }));

    const dialog = await screen.findByRole("dialog", { name: "Reject verification for Ada Obi?" });
    const confirm = within(dialog).getByRole("button", { name: "Reject verification" });

    expect(within(dialog).getByText(/audit log against your account/)).toBeInTheDocument();
    expect(confirm).toBeDisabled();

    await user.type(within(dialog).getByLabelText(/Reason/), "ab");
    expect(confirm).toBeDisabled();
    expect(review).not.toHaveBeenCalled();

    await user.type(within(dialog).getByLabelText(/Reason/), "c blurred document");
    await user.click(confirm);

    await waitFor(() => {
      expect(review).toHaveBeenCalledTimes(1);
    });
    expect(review).toHaveBeenCalledWith(kycItem.userId, { decision: "REJECT", reason: "abc blurred document" });
  });

  it("disables decisions without kyc:write", async () => {
    const user = userEvent.setup();
    const { compliance } = renderConsole({ path: "/kyc", flags: ON, permissions: ["kyc:read"], compliance: { listKycQueue: page([kycItem]) } });

    await user.click(await within(await screen.findByRole("table", { name: "KYC review queue" })).findByText("Ada Obi"));

    const drawer = await screen.findByRole("dialog", { name: "Ada Obi" });

    expect(within(drawer).getByRole("button", { name: "Approve" })).toBeDisabled();
    expect(compliance.calls("reviewKyc")).not.toHaveBeenCalled();
  });

  it("renders an unavailable state when the queue is not deployed", async () => {
    renderConsole({ path: "/kyc", flags: ON, compliance: { listKycQueue: () => Promise.reject(new DataSourceError("NOT_IMPLEMENTED", "not deployed")) } });

    expect(await screen.findByText("Not available yet")).toBeInTheDocument();
    expect(screen.getByText(/has not deployed the KYC review queue/)).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "KYC review queue" })).not.toBeInTheDocument();
  });

  it("says previews are served by the platform when the preview route is not deployed, and opens nothing", async () => {
    const user = userEvent.setup();
    const open = vi.spyOn(window, "open").mockReturnValue(null);

    renderConsole({ path: "/kyc", flags: ON, compliance: { listKycQueue: page([kycItem]), previewKycDocument: () => Promise.reject(new DataSourceError("NOT_IMPLEMENTED", "no store")) } });
    await user.click(await within(await screen.findByRole("table", { name: "KYC review queue" })).findByText("Ada Obi"));
    await user.click(within(await screen.findByRole("dialog", { name: "Ada Obi" })).getByRole("button", { name: /View .* document/ }));

    expect(await screen.findByText(/previews are served by the platform/)).toBeInTheDocument();
    expect(open).not.toHaveBeenCalled();
  });

  it("opens a preview only when the platform's link is https", async () => {
    const user = userEvent.setup();
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const preview = vi.fn().mockResolvedValueOnce({ url: "http://files.example.test/doc", expiresAt: NOW, contentType: "image/jpeg" }).mockResolvedValueOnce({ url: "https://files.example.test/doc?sig=1", expiresAt: NOW, contentType: "image/jpeg" });

    renderConsole({ path: "/kyc", flags: ON, compliance: { listKycQueue: page([kycItem]), previewKycDocument: preview } });
    await user.click(await within(await screen.findByRole("table", { name: "KYC review queue" })).findByText("Ada Obi"));

    const view = within(await screen.findByRole("dialog", { name: "Ada Obi" })).getByRole("button", { name: /View .* document/ });

    await user.click(view);
    await waitFor(() => {
      expect(preview).toHaveBeenCalledTimes(1);
    });
    expect(open).not.toHaveBeenCalled();

    await user.click(view);
    await waitFor(() => {
      expect(open).toHaveBeenCalledWith("https://files.example.test/doc?sig=1", "_blank", "noopener,noreferrer");
    });
  });
});

describe("payments", () => {
  it("reviews a pending withdrawal only after a reasoned confirmation", async () => {
    const user = userEvent.setup();
    const { compliance } = renderConsole({ path: "/payments", flags: ON, compliance: { listPayments: page([withdrawal]), reviewWithdrawal: { ...withdrawal, status: "PROCESSING" } } });
    const review = compliance.calls("reviewWithdrawal");
    const table = await screen.findByRole("table", { name: "Payments" });

    await within(table).findByText(withdrawal.reference);
    await user.click(within(table).getByRole("button", { name: "Approve" }));

    const dialog = await screen.findByRole("dialog", { name: `Approve withdrawal ${withdrawal.reference}?` });
    const confirm = within(dialog).getByRole("button", { name: "Approve withdrawal" });

    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/Reason/), "verified account owner");
    expect(review).not.toHaveBeenCalled();
    await user.click(confirm);

    await waitFor(() => {
      expect(review).toHaveBeenCalledTimes(1);
    });
    expect(review).toHaveBeenCalledWith(withdrawal.reference, { decision: "APPROVE", reason: "verified account owner" });
  });

  it("offers no review on a withdrawal that is not pending", async () => {
    renderConsole({ path: "/payments", flags: ON, compliance: { listPayments: page([{ ...withdrawal, status: "CONFIRMED" }]) } });

    const table = await screen.findByRole("table", { name: "Payments" });

    await within(table).findByText(withdrawal.reference);
    expect(within(table).queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  });

  it("reads its filters from the address and writes changes back to it", async () => {
    const user = userEvent.setup();
    const { compliance, router } = renderConsole({ path: "/payments?direction=WITHDRAWAL&status=PENDING&provider=PAYSTACK&from=2026-09-01&to=2026-09-20&q=WDR9&page=2", flags: ON, compliance: { listPayments: page([withdrawal]) } });
    const list = compliance.calls("listPayments");

    await waitFor(() => {
      expect(list).toHaveBeenCalled();
    });

    const first = list.mock.calls[0]?.[0] as Record<string, unknown>;

    expect(first).toMatchObject({ page: 2, search: "WDR9", direction: "WITHDRAWAL", status: "PENDING", provider: "PAYSTACK" });
    expect(typeof first["from"]).toBe("string");
    expect(typeof first["to"]).toBe("string");

    await user.selectOptions(screen.getByRole("combobox", { name: "Provider" }), "FLUTTERWAVE");

    await waitFor(() => {
      expect(new URLSearchParams(router.state.location.search).get("provider")).toBe("FLUTTERWAVE");
    });

    const params = new URLSearchParams(router.state.location.search);

    expect(params.get("direction")).toBe("WITHDRAWAL");
    expect(params.get("from")).toBe("2026-09-01");
    expect(params.get("page")).toBeNull();
    await waitFor(() => {
      expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ provider: "FLUTTERWAVE", page: 1 }));
    });
  });

  it("ignores filter values the contract does not know", async () => {
    const { compliance } = renderConsole({ path: "/payments?direction=SIDEWAYS&status=nope", flags: ON });
    const list = compliance.calls("listPayments");

    await waitFor(() => {
      expect(list).toHaveBeenCalled();
    });
    expect(list.mock.calls[0]?.[0]).not.toHaveProperty("direction");
    expect(list.mock.calls[0]?.[0]).not.toHaveProperty("status");
  });

  it("shows provider status as words with the figures the platform reported", async () => {
    renderConsole({
      path: "/payments",
      flags: ON,
      compliance: {
        getPaymentOverview: {
          depositsToday: 1_000_000,
          withdrawalsToday: 0,
          pendingDeposits: 2,
          pendingWithdrawals: 3,
          failedToday: 1,
          providers: [
            { provider: "PAYSTACK", status: "UP", checkedAt: NOW },
            { provider: "FLUTTERWAVE", status: "DOWN", checkedAt: NOW },
          ],
        },
      },
    });

    expect(await screen.findByText("Down")).toBeInTheDocument();
    expect(screen.getByText("Up")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});

describe("responsible gaming", () => {
  it("lists flagged accounts read-only", async () => {
    renderConsole({
      path: "/responsible-gaming",
      flags: ON,
      compliance: {
        listResponsibleGaming: page([
          {
            userId: "33333333-3333-4333-8333-333333333333",
            displayName: "Kemi Ade",
            email: "kemi@example.test",
            limits: [{ kind: "deposit_daily", status: "active", value: 5_000_000, used: 1_000_000, effectiveAt: NOW }],
            selfExclusion: { active: true, period: "30d", startedAt: NOW, endsAt: "2026-10-21T12:00:00.000Z" },
            restricted: true,
            flaggedAt: NOW,
            flags: ["SELF_EXCLUDED"],
          },
        ]),
      },
    });

    const table = await screen.findByRole("table", { name: "Flagged accounts" });

    expect(await within(table).findByText("Kemi Ade")).toBeInTheDocument();
    expect(within(table).getByText("Self-excluded")).toBeInTheDocument();
    expect(within(table).queryAllByRole("button").filter((b) => /suspend|approve|reject|lift|remove/i.test(b.textContent))).toEqual([]);
  });
});
