import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { matchAdminActionSchema } from "@betng/contracts";
import { NAV } from "../../src/lib/navigation";
import { renderConsole } from "../helpers/render";
import { customer, fixture, page } from "../helpers/rows";

const FORBIDDEN = /choose winner|force winner|set winner|set score|set result|manipulate|override result/i;

const NOW = "2026-09-21T12:00:00.000Z";
const shop = { id: "44444444-4444-4444-8444-444444444444", code: "TST-001", name: "Test Shop", address: "1 Test Road", phone: "+2348000000000", email: "shop@example.test", status: "ACTIVE", ownerName: "Shop Owner", balance: 5_000_000, createdAt: NOW, cashierCount: 1, todaySales: 100_000, todayPayouts: 50_000, openTickets: 3 };
const cashier = { id: "55555555-5555-4555-8555-555555555555", shopId: shop.id, username: "till.one", displayName: "Till One", role: "CASHIER", status: "ACTIVE", createdAt: NOW, todayTransactions: 4, todaySales: 100_000 };
const team = { id: "66666666-6666-4666-8666-666666666666", leagueId: fixture.leagueId, leagueName: "Test League", name: "Harbour Town", shortName: "Harbour", code: "HAR", status: "ACTIVE", colors: { primary: "#224488", secondary: "#ffffff" }, ratings: { attack: 70, midfield: 70, defence: 70, goalkeeper: 70, pace: 70, finishing: 70, form: 0 }, updatedAt: NOW };
const run = { id: "sim-0001", matchId: fixture.matchId, status: "FAILED", events: 0, score: null, seed: null, matchLabel: "Harbour Town v Ridge United", leagueName: "Test League", error: "Timed out" };
const settlement = { id: "stl-0001", betId: "bet-0001", owner: "user:Ada O.", channel: "ONLINE", matchLabel: "Harbour Town v Ridge United", result: "2-1", stake: 100_000, payout: 0, status: "FAILED", error: "Ledger write failed", timestamp: NOW };
const market = {
  marketId: "77777777-7777-4777-8777-777777777777",
  matchId: fixture.matchId,
  matchLabel: "Harbour Town v Ridge United",
  leagueName: "Test League",
  marketType: "MATCH_RESULT",
  marketLabel: "Match Result",
  status: "OPEN",
  margin: 0.06,
  exposure: 100_000,
  selections: [{ selectionId: "88888888-8888-4888-8888-888888888888", label: "Harbour Town", currentOdds: 2.1, openingOdds: 2, modelProbability: 0.45, stake: 100_000, liability: 110_000 }],
  updatedAt: NOW,
};
const league = { id: fixture.leagueId, name: "Test League", code: "TSL", slug: "test-league", sport: "FOOTBALL", status: "ACTIVE", country: "Testland", teamCount: 10, matchdays: 18, currentSeason: 1, currentMatchday: 4, cycleSeconds: 300 };

const ROWS: Readonly<Record<string, readonly unknown[]>> = { users: [customer], shops: [shop], cashiers: [cashier], teams: [team], fixtures: [fixture], simulations: [run], settlements: [settlement] };

const ROUTES = [
  ...NAV.flatMap((group) => group.items.map((item) => item.to)),
  `/shops/${shop.id}`,
  `/shops/${shop.id}?tab=cashiers`,
  `/shops/${shop.id}?tab=reports`,
  `/leagues/${league.id}`,
  `/leagues/${league.id}?tab=odds`,
  `/leagues/${league.id}?tab=simulation`,
  `/teams/${team.id}`,
  `/matches/${fixture.matchId}`,
  "/no-such-screen",
];

const CONTROLS = "button, a, input, select, textarea, summary, label, [role='button'], [role='tab'], [role='menuitem'], [role='switch'], [role='radio'], [role='option'], [role='link']";

function controlLabels(): readonly string[] {
  return [...document.querySelectorAll(CONTROLS)].map((element) => [element.textContent, element.getAttribute("aria-label"), element.getAttribute("title"), element.getAttribute("placeholder"), element.getAttribute("value")].filter((part) => part !== null).join(" "));
}

function renderRoute(path: string): void {
  renderConsole({
    path,
    admin: {
      queryList: (resource: string) => Promise.resolve(page(ROWS[resource] ?? [])),
      getFixture: fixture,
      getShop: shop,
      listMarketOdds: [market],
    },
    data: { listLeagues: () => Promise.resolve([league]) },
    flags: { complianceEnabled: true },
  });
}

afterEach(cleanup);

describe("no control can decide a match", () => {
  it("covers every screen in the navigation plus the detail screens", () => {
    expect(ROUTES.length).toBeGreaterThanOrEqual(28);
  });

  it.each(ROUTES)("%s offers nothing that picks a winner, a score or a result", async (path) => {
    renderRoute(path);

    await screen.findByRole("heading", { level: 1 }, { timeout: 5000 });
    await waitFor(() => {
      expect(document.querySelector("table[aria-busy='true']")).toBeNull();
    });

    const labels = controlLabels();

    expect(labels.length).toBeGreaterThan(5);
    expect(labels.filter((label) => FORBIDDEN.test(label))).toEqual([]);
  });

  it("offers exactly the match operations the contract allows, and their menus hide nothing else", async () => {
    const user = userEvent.setup();

    renderRoute(`/matches/${fixture.matchId}`);

    const heading = await screen.findByRole("heading", { level: 2, name: "Operations" });
    const panel = heading.closest("section");
    const operations = [...(panel?.querySelectorAll("button") ?? [])].map((button) => button.textContent.trim());

    expect(operations).toEqual(["Reopen betting", "Suspend betting", "Prepare run now", "Re-queue failed run", "Void match"]);
    expect(operations).toHaveLength(matchAdminActionSchema.options.length);

    await user.click(screen.getByRole("button", { name: "Re-queue failed run" }));
    await screen.findByRole("dialog", { name: "Re-queue failed run?" });

    expect(controlLabels().filter((label) => FORBIDDEN.test(label))).toEqual([]);
  });
});
