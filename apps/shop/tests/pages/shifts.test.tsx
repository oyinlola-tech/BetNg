import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CashierShift, ShopSession } from "@betng/contracts";
import { DEFAULT_FLAGS, DataSourceError, createSessionStore, formatMoney, formatSignedMoney, type ShopShiftSource } from "@betng/ui-core";
import { FeatureFlagsProvider, ToastProvider } from "@betng/ui-web";

const fake = vi.hoisted(() => ({ shifts: {} as ShopShiftSource, session: undefined as unknown }));

vi.mock("../../src/services/dataSource", () => ({
  shopSource: {
    get session() {
      return fake.session;
    },
    get shifts() {
      return fake.shifts;
    },
    subscribe: () => () => undefined,
  },
  dataSource: {},
  isMock: () => false,
}));

const { ShiftPage } = await import("../../src/pages/ShiftPage");
const { ShiftClosePage } = await import("../../src/pages/ShiftClosePage");

const SESSION: ShopSession = {
  token: "test-token-000000000000",
  expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  shop: { id: "shop-1", code: "BNG-LAG-001", name: "Test Shop", address: "1 Road", phone: "0800", email: "shop@example.com", status: "ACTIVE", ownerName: "Owner", balance: 0, createdAt: new Date().toISOString() },
  cashier: { id: "cashier-1", shopId: "shop-1", username: "bisi", displayName: "Bisi Adeyemi", role: "CASHIER", status: "ACTIVE", createdAt: new Date().toISOString() },
  permissions: ["tickets:sell", "tickets:check", "tickets:payout"],
} as unknown as ShopSession;

function openShift(overrides: Partial<CashierShift> = {}): CashierShift {
  return {
    id: "shift-0001-aaaa",
    cashierId: "cashier-1",
    cashierName: "Bisi Adeyemi",
    status: "OPEN",
    openedAt: new Date().toISOString(),
    totals: { openingFloat: 2_000_000, sales: 500_000, payouts: 100_000, cancellations: 0, cashIn: 0, cashOut: 0, expectedCash: 2_400_000, ticketsSold: 3 },
    ...overrides,
  };
}

function shiftSource(overrides: Partial<ShopShiftSource> = {}): ShopShiftSource {
  return {
    getCurrent: vi.fn(() => Promise.resolve(null)),
    open: vi.fn(() => Promise.resolve(openShift())),
    recordCash: vi.fn(() => Promise.resolve(openShift())),
    close: vi.fn(() => Promise.reject(new Error("not expected"))),
    list: vi.fn(() => Promise.resolve([])),
    ...overrides,
  };
}

function renderAt(path: string, element: React.ReactElement, flags: Partial<typeof DEFAULT_FLAGS> = { cashShiftsEnabled: true }): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  const router = createMemoryRouter([{ path, element }, { path: "*", element: <p>elsewhere</p> }], { initialEntries: [path] });

  render(
    <FeatureFlagsProvider flags={{ ...DEFAULT_FLAGS, ...flags }}>
      <QueryClientProvider client={client}>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </QueryClientProvider>
    </FeatureFlagsProvider>,
  );
}

beforeEach(() => {
  const store = createSessionStore<ShopSession>("test.shop.session");

  store.set(SESSION);
  fake.session = store;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("cash shifts", () => {
  it("says the feature is not available when the flag is off, without asking the platform", async () => {
    fake.shifts = shiftSource();
    renderAt("/cashier/shift", <ShiftPage />, { cashShiftsEnabled: false });

    expect(await screen.findByText("Not available yet")).toBeInTheDocument();
    expect(fake.shifts.getCurrent).not.toHaveBeenCalled();
  });

  it("shows the unavailable state when the platform does not serve shifts yet", async () => {
    fake.shifts = shiftSource({ getCurrent: vi.fn(() => Promise.reject(new DataSourceError("NOT_IMPLEMENTED", "Not served"))) });
    renderAt("/cashier/shift", <ShiftPage />);

    expect(await screen.findByText("Not available yet")).toBeInTheDocument();
  });

  it("sends an idempotency key with Start shift and reuses it when the cashier retries", async () => {
    const user = userEvent.setup();
    const open = vi.fn<ShopShiftSource["open"]>().mockRejectedValueOnce(new DataSourceError("NETWORK", "The connection dropped.")).mockResolvedValueOnce(openShift());

    fake.shifts = shiftSource({ open });
    renderAt("/cashier/shift", <ShiftPage />);

    await user.type(await screen.findByLabelText("Opening float"), "20000");
    await user.click(screen.getByRole("button", { name: "Start shift" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The connection dropped.");

    await user.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => {
      expect(open).toHaveBeenCalledTimes(2);
    });

    const [first, second] = open.mock.calls;

    expect(first?.[0]).toBe(2_000_000);
    expect(first?.[1]).toMatch(/^[0-9a-f-]{36}$/);
    expect(second?.[1]).toBe(first?.[1]);
  });

  it("mints a new key when the amount changes after a failure", async () => {
    const user = userEvent.setup();
    const open = vi.fn<ShopShiftSource["open"]>().mockRejectedValueOnce(new DataSourceError("NETWORK", "Dropped.")).mockResolvedValueOnce(openShift());

    fake.shifts = shiftSource({ open });
    renderAt("/cashier/shift", <ShiftPage />);

    const input = await screen.findByLabelText("Opening float");

    await user.type(input, "20000");
    await user.click(screen.getByRole("button", { name: "Start shift" }));
    await screen.findByRole("alert");
    await user.type(input, "0");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => {
      expect(open).toHaveBeenCalledTimes(2);
    });

    expect(open.mock.calls[1]?.[1]).not.toBe(open.mock.calls[0]?.[1]);
  });

  it("shows the platform's discrepancy after close, not one worked out from the count", async () => {
    const user = userEvent.setup();
    const close = vi.fn<ShopShiftSource["close"]>(() =>
      Promise.resolve(openShift({ status: "CLOSED", closedAt: new Date().toISOString(), countedCash: 2_350_000, discrepancy: -50_000, totals: { ...openShift().totals, expectedCash: 2_400_000 } })),
    );

    fake.shifts = shiftSource({ getCurrent: vi.fn(() => Promise.resolve(openShift())), close });
    renderAt("/cashier/shift/close", <ShiftClosePage />);

    await user.type(await screen.findByLabelText(`Number of ${formatMoney(100_000, { fraction: "never" })} notes`), "20");
    expect(screen.getByTestId("counted-as-entered")).toHaveTextContent(formatMoney(2_000_000));

    await user.type(screen.getByLabelText("Your cashier PIN"), "1234");
    await user.click(screen.getByRole("button", { name: "Close shift" }));

    expect(await screen.findByTestId("platform-discrepancy")).toHaveTextContent(formatSignedMoney(-50_000));
    expect(screen.getByText("Short")).toBeInTheDocument();
    expect(screen.queryByText(formatSignedMoney(2_000_000 - 2_400_000))).not.toBeInTheDocument();

    const [shiftId, request, key] = close.mock.calls[0] ?? [];

    expect(shiftId).toBe("shift-0001-aaaa");
    expect(request?.pin).toBe("1234");
    expect(request?.counted.find((row) => row.denomination === 100_000)?.count).toBe(20);
    expect(key).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("keeps cash out behind the platform-issued permission", async () => {
    fake.shifts = shiftSource({ getCurrent: vi.fn(() => Promise.resolve(openShift())) });
    renderAt("/cashier/shift", <ShiftPage />);

    expect(await screen.findByRole("button", { name: "Cash out" })).toBeDisabled();
    expect(screen.getByText("Cash in and cash out need a manager.")).toBeInTheDocument();
  });
});
