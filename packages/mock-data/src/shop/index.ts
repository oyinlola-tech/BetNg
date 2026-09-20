import type { Cashier, ShopDailyReport, ShopPermission, ShopSession, ShopTransaction, ShopTransactionType, Ticket, TicketId, TicketSelection } from "@betng/contracts";
import {
  DataSourceError,
  FULL_TIME_SECONDS,
  MAX_SELECTIONS,
  STAKE_LIMITS,
  VIRTUAL_TIMING,
  createSessionStore,
  formatMoney,
  formatScore,
  toLocalDateKey,
  type MarketKind,
  type SessionStorage,
  type ShopDataSource,
} from "@betng/ui-core";
import type { KeyValueStorage, MockPlatform } from "../engine.js";
import { marketsFor, settleSelection } from "../markets.js";
import { rng, uuidFrom } from "../prng.js";
import { statusAt } from "../season.js";
import { scriptFor } from "../simulate.js";
import { CASHIERS, DEMO_PASSWORD, DEMO_PIN, OPENING_FLOAT, ROLE_PERMISSIONS, SHOP, SHOP_ID } from "./directory.js";
import { combinedOddsOf, expiryFor, pastDateKeys, pastDayTickets, ticketCode, todaySeedTickets } from "./history.js";

export interface MockShopOptions {
  /** The virtual season tickets are sold and settled against. */
  readonly platform: MockPlatform;
  readonly storage?: KeyValueStorage & { remove?(key: string): void };
  /** Where the cashier session lives; a terminal should not stay signed in across browser restarts. */
  readonly sessionStorage?: SessionStorage;
  readonly latencyMs?: number;
}

interface ShopState {
  float: number;
  tickets: Ticket[];
  transactions: ShopTransaction[];
  seededFor: string;
  sequence: number;
}

const STATE_KEY = "betng.mock.shop.v1";
const SESSION_KEY = "betng.shop.session";
const SESSION_MS = 8 * 60 * 60 * 1000;
const HISTORY_DAYS = 21;

export function createMockShopSource(options: MockShopOptions): ShopDataSource {
  const { platform, storage } = options;
  const now = platform.now;
  const session = createSessionStore<ShopSession>(SESSION_KEY, options.sessionStorage ?? storage, now);
  const listeners = new Set<() => void>();

  let state = load();

  function load(): ShopState {
    try {
      const raw = storage?.get(STATE_KEY);

      if (typeof raw === "string" && raw !== "") return JSON.parse(raw) as ShopState;
    } catch {
      /* fall through to a fresh shop */
    }

    return { float: OPENING_FLOAT, tickets: [], transactions: [], seededFor: "", sequence: 0 };
  }

  function commit(): void {
    storage?.set(STATE_KEY, JSON.stringify(state));

    const active = session.snapshot();

    /* The session carries the float the topbar shows, so it moves with every sale and payout. */
    if (active.status === "AUTHENTICATED" && active.session !== undefined && active.session.shop.balance !== state.float) {
      session.set({ ...active.session, shop: { ...active.session.shop, balance: state.float } });
    }

    for (const listener of listeners) listener();
  }

  function ledger(type: ShopTransactionType, amount: number, by: Pick<Cashier, "id" | "displayName">, reference: string, at: number, note?: string): void {
    state.float += amount;
    state.sequence += 1;
    state.transactions.push({
      id: uuidFrom(`shop:txn:${String(state.sequence)}:${reference}:${type}`),
      shopId: SHOP_ID,
      cashierId: by.id,
      cashierName: by.displayName,
      type,
      amount,
      balanceAfter: state.float,
      reference,
      ...(note === undefined ? {} : { note }),
      createdAt: new Date(at).toISOString(),
    });
  }

  function seedToday(): void {
    const today = toLocalDateKey(new Date(now()));

    if (state.seededFor === today) return;

    const recent = todaySeedTickets(now());

    if (recent.length === 0) return;

    /* The day so far: generated trade up to a quarter of an hour ago, then tickets on matches that really finished. */
    const cutoff = now() - 15 * 60_000;
    const earlier = pastDayTickets(today, now()).filter((t) => Date.parse(t.settledAt ?? t.placedAt) < cutoff && (t.paidAt === undefined || Date.parse(t.paidAt) < cutoff));
    const seeded = [...earlier, ...recent];

    const events = seeded
      .flatMap((t) => [
        { at: Date.parse(t.placedAt), run: () => ledger("TICKET_SALE", t.stake, { id: t.cashierId, displayName: t.cashierName }, t.code, Date.parse(t.placedAt)) },
        ...(t.status === "CANCELLED" && t.settledAt !== undefined
          ? [{ at: Date.parse(t.settledAt), run: () => ledger("TICKET_CANCEL", -t.stake, { id: t.cashierId, displayName: t.cashierName }, t.code, Date.parse(t.settledAt as string), "Customer changed their mind") }]
          : []),
        ...(t.paidAt !== undefined ? [{ at: Date.parse(t.paidAt), run: () => ledger("TICKET_PAYOUT", -(t.payout ?? 0), { id: t.cashierId, displayName: t.cashierName }, t.code, Date.parse(t.paidAt as string)) }] : []),
      ])
      .sort((a, b) => a.at - b.at);

    for (const event of events) event.run();

    state.tickets.push(...seeded);
    state.seededFor = today;
    storage?.set(STATE_KEY, JSON.stringify(state));
  }

  function current(): ShopSession {
    const snapshot = session.snapshot();

    if (snapshot.status === "EXPIRED") throw new DataSourceError("SESSION_EXPIRED", "Your session has ended. Sign in again to continue.");
    if (snapshot.session === undefined) throw new DataSourceError("UNAUTHENTICATED", "Sign in to continue.");

    return snapshot.session;
  }

  async function authorised(permission: ShopPermission): Promise<ShopSession> {
    await platform.delay();

    const active = current();

    if (!(active.permissions ?? []).includes(permission)) throw new DataSourceError("FORBIDDEN", `Your role does not include “${permission}”.`);

    seedToday();

    return active;
  }

  function allTickets(): readonly Ticket[] {
    const own = new Set(state.tickets.map((t) => t.code));
    const past = pastDateKeys(now(), HISTORY_DAYS).flatMap((key) => pastDayTickets(key, now()).filter((t) => !own.has(t.code)));

    return [...state.tickets, ...past].sort((a, b) => b.placedAt.localeCompare(a.placedAt));
  }

  function find(code: string): Ticket {
    const wanted = code.trim().toUpperCase();
    const ticket = allTickets().find((t) => t.code === wanted);

    if (ticket === undefined) throw new DataSourceError("NOT_FOUND", `No ticket ${wanted} was sold at this shop.`);

    return ticket;
  }

  /** Adopts a generated past ticket into the persisted store the first time it changes. */
  function replace(next: Ticket): void {
    const index = state.tickets.findIndex((t) => t.code === next.code);

    if (index === -1) state.tickets.push(next);
    else state.tickets[index] = next;
  }

  function selectionCode(leg: TicketSelection): string | undefined {
    const fixture = platform.fixture(leg.matchId);

    if (fixture === undefined) return undefined;

    return marketsFor(fixture, fixture.kickoffMs)
      .markets.flatMap((m) => m.selections)
      .find((s) => s.id === leg.selectionId)?.code;
  }

  /** @endpoint (internal) settlement reacts to COMPLETED matches; the terminal only reads the outcome. */
  function settle(): void {
    const t = now();
    let changed = false;

    state.tickets = state.tickets.map((ticket) => {
      if (ticket.status === "WON" && t > Date.parse(ticket.expiresAt)) {
        changed = true;

        return { ...ticket, status: "EXPIRED" };
      }

      if (ticket.status !== "OPEN") return ticket;

      const selections = ticket.selections.map((leg): TicketSelection => {
        if (leg.outcome !== "PENDING") return leg;

        const fixture = platform.fixture(leg.matchId);

        if (fixture === undefined) return { ...leg, outcome: "VOID", result: "Void" };
        if ((t - fixture.kickoffMs) / 1000 < FULL_TIME_SECONDS + VIRTUAL_TIMING.settlementDelaySeconds) return leg;

        const score = scriptFor(fixture).finalScore;
        const code = selectionCode(leg);

        return code === undefined
          ? { ...leg, outcome: "VOID", result: "Void" }
          : { ...leg, outcome: settleSelection(leg.marketType as MarketKind, code, score), result: formatScore(score.home, score.away) };
      });

      if (selections.every((leg, i) => leg === ticket.selections[i])) return ticket;

      changed = true;

      if (selections.some((l) => l.outcome === "PENDING") && !selections.some((l) => l.outcome === "LOST")) return { ...ticket, selections };

      const voided = selections.every((l) => l.outcome === "VOID");
      const lost = selections.some((l) => l.outcome === "LOST");
      const liveOdds = combinedOddsOf(selections.filter((l) => l.outcome === "WON"));

      return {
        ...ticket,
        selections,
        status: voided ? "VOID" : lost ? "LOST" : "WON",
        payout: voided ? ticket.stake : lost ? 0 : Math.round(ticket.stake * liveOdds),
        settledAt: new Date(t).toISOString(),
      };
    });

    if (changed) commit();
  }

  setInterval(settle, 1000);

  function report(date: string): ShopDailyReport {
    const tickets = allTickets();
    const sold = tickets.filter((t) => toLocalDateKey(new Date(t.placedAt)) === date);
    const paid = tickets.filter((t) => t.paidAt !== undefined && toLocalDateKey(new Date(t.paidAt)) === date);
    const cancelled = sold.filter((t) => t.status === "CANCELLED");
    const kept = sold.filter((t) => t.status !== "CANCELLED");
    const sales = kept.reduce((acc, t) => acc + t.stake, 0);
    const payouts = paid.reduce((acc, t) => acc + (t.payout ?? 0), 0);
    const byCashier = new Map<string, { cashierId: Cashier["id"]; cashierName: string; ticketsSold: number; sales: number; payouts: number }>();
    const byLeague = new Map<string, { leagueName: string; ticketsSold: number; sales: number }>();

    for (const t of kept) {
      const c = byCashier.get(t.cashierId) ?? { cashierId: t.cashierId, cashierName: t.cashierName, ticketsSold: 0, sales: 0, payouts: 0 };

      c.ticketsSold += 1;
      c.sales += t.stake;
      byCashier.set(t.cashierId, c);

      const leagueName = new Set(t.selections.map((s) => s.leagueName)).size === 1 ? (t.selections[0]?.leagueName ?? "Mixed") : "Mixed leagues";
      const l = byLeague.get(leagueName) ?? { leagueName, ticketsSold: 0, sales: 0 };

      l.ticketsSold += 1;
      l.sales += t.stake;
      byLeague.set(leagueName, l);
    }

    for (const t of paid) {
      const c = byCashier.get(t.cashierId);

      if (c !== undefined) c.payouts += t.payout ?? 0;
    }

    return {
      shopId: SHOP_ID,
      date,
      ticketsSold: kept.length,
      sales,
      payouts,
      cancellations: cancelled.length,
      openTickets: sold.filter((t) => t.status === "OPEN").length,
      net: sales - payouts,
      byCashier: [...byCashier.values()].sort((a, b) => b.sales - a.sales),
      byLeague: [...byLeague.values()].sort((a, b) => b.sales - a.sales),
    };
  }

  /** Past days have no persisted ledger, so theirs is rebuilt from that day's tickets. */
  function pastLedger(date: string): readonly ShopTransaction[] {
    const base = OPENING_FLOAT + rng(`shop:float:${date}`).int(-40, 60) * 100_000;
    const events = pastDayTickets(date, now())
      .flatMap((t) => [
        { at: t.placedAt, type: "TICKET_SALE" as const, amount: t.stake, t },
        ...(t.paidAt !== undefined && toLocalDateKey(new Date(t.paidAt)) === date ? [{ at: t.paidAt, type: "TICKET_PAYOUT" as const, amount: -(t.payout ?? 0), t }] : []),
      ])
      .sort((a, b) => a.at.localeCompare(b.at));
    let balance = base;

    return events
      .map((e): ShopTransaction => {
        balance += e.amount;

        return { id: uuidFrom(`shop:txn:${date}:${e.t.code}:${e.type}`), shopId: SHOP_ID, cashierId: e.t.cashierId, cashierName: e.t.cashierName, type: e.type, amount: e.amount, balanceAfter: balance, reference: e.t.code, createdAt: e.at };
      })
      .reverse();
  }

  return {
    session,

    /** @endpoint POST /api/v1/shop/auth/login ShopLoginRequest → ShopSession */
    login: async (request) => {
      await platform.delay();

      const cashier = CASHIERS.find((c) => c.username === request.username.trim().toLowerCase());

      if (request.shopCode.trim().toUpperCase() !== SHOP.code || cashier === undefined || request.password !== DEMO_PASSWORD || request.pin !== DEMO_PIN) {
        throw new DataSourceError("INVALID_CREDENTIALS", "Those details do not match a cashier at this shop.");
      }
      if (cashier.status === "SUSPENDED") throw new DataSourceError("FORBIDDEN", "This cashier account is suspended. Speak to the shop manager.");

      seedToday();

      const next: ShopSession = {
        token: `${uuidFrom(`shop:session:${cashier.username}:${String(now())}`)}`.replaceAll("-", ""),
        expiresAt: new Date(now() + SESSION_MS).toISOString(),
        shop: { ...SHOP, balance: state.float },
        cashier: { ...cashier, lastActiveAt: new Date(now()).toISOString() },
        permissions: ROLE_PERMISSIONS[cashier.role],
      };

      session.set(next);

      return next;
    },

    /** @endpoint POST /api/v1/shop/auth/logout → 204 */
    logout: async () => {
      session.clear();
      await Promise.resolve();
    },

    /** @endpoint POST /api/v1/shop/tickets PlaceTicketRequest → Ticket */
    placeTicket: async (input) => {
      const active = await authorised("tickets:sell");

      if (input.selections.length === 0) throw new DataSourceError("VALIDATION", "Add a selection first.");
      if (input.selections.length > MAX_SELECTIONS) throw new DataSourceError("VALIDATION", `A ticket holds at most ${String(MAX_SELECTIONS)} selections.`);
      if (!Number.isFinite(input.stake) || input.stake < STAKE_LIMITS.min) throw new DataSourceError("VALIDATION", `The minimum stake is ${formatMoney(STAKE_LIMITS.min)}.`);
      if (input.stake > STAKE_LIMITS.max) throw new DataSourceError("VALIDATION", `The maximum stake is ${formatMoney(STAKE_LIMITS.max)}.`);

      const t = now();
      const selections = input.selections.map((leg): TicketSelection => {
        const fixture = platform.fixture(leg.matchId);

        if (fixture === undefined || statusAt(fixture, t) !== "BETTING_OPEN") throw new DataSourceError("BETTING_CLOSED", `Betting has closed on ${leg.matchLabel}.`);

        const market = marketsFor(fixture, t).markets.find((m) => m.id === leg.marketId);
        const priced = market?.selections.find((s) => s.id === leg.selectionId);

        if (market === undefined || priced === undefined || market.status !== "OPEN") throw new DataSourceError("BETTING_CLOSED", `${leg.marketName} is suspended on ${leg.matchLabel}.`);
        if (Math.abs(priced.odds - leg.odds) > 0.005) throw new DataSourceError("CONFLICT", `Odds changed on ${leg.matchLabel}. Review the slip and accept the new price.`);

        return {
          matchId: leg.matchId,
          marketId: leg.marketId,
          selectionId: leg.selectionId,
          odds: priced.odds,
          marketType: market.kind,
          marketLabel: market.name,
          selectionLabel: priced.label,
          matchLabel: leg.matchLabel,
          leagueName: fixture.competition.seed.name,
          kickoffAt: new Date(fixture.kickoffMs).toISOString(),
          outcome: "PENDING",
        };
      });

      const totalOdds = combinedOddsOf(selections);
      const customerName = input.customerName?.trim();
      const customerPhone = input.customerPhone?.trim();
      const ticket: Ticket = {
        id: uuidFrom(`shop:ticket:${String(state.sequence)}:${String(t)}`) as TicketId,
        code: ticketCode(rng(`shop:code:${String(state.sequence)}:${String(t)}`)),
        shopId: SHOP_ID,
        shopCode: SHOP.code,
        cashierId: active.cashier.id,
        cashierName: active.cashier.displayName,
        ...(customerName === undefined || customerName === "" ? {} : { customerName }),
        ...(customerPhone === undefined || customerPhone === "" ? {} : { customerPhone }),
        selections,
        stake: input.stake,
        totalOdds,
        potentialPayout: Math.round(input.stake * totalOdds),
        status: "OPEN",
        placedAt: new Date(t).toISOString(),
        expiresAt: expiryFor(t),
      };

      state.tickets.push(ticket);
      ledger("TICKET_SALE", ticket.stake, active.cashier, ticket.code, t);
      commit();

      return ticket;
    },

    /** @endpoint GET /api/v1/shop/tickets?status=&q=&date= → { items: Ticket[] } */
    listTickets: async (filter = {}) => {
      await authorised("tickets:check");

      const q = filter.q?.trim().toLowerCase() ?? "";
      const today = toLocalDateKey(new Date(now()));

      return allTickets().filter((t) => {
        if (filter.status !== undefined && t.status !== filter.status) return false;
        if (filter.date !== undefined && toLocalDateKey(new Date(t.placedAt)) !== filter.date) return false;
        if (q !== "") return t.code.toLowerCase().includes(q) || (t.customerName?.toLowerCase().includes(q) ?? false) || (t.customerPhone?.replaceAll(" ", "").includes(q.replaceAll(" ", "")) ?? false);

        /* Without a date or a search the list is the working set: today plus anything still actionable. */
        return filter.date !== undefined || toLocalDateKey(new Date(t.placedAt)) === today || t.status === "OPEN" || t.status === "WON";
      });
    },

    /** @endpoint GET /api/v1/shop/tickets/:code → Ticket */
    getTicket: async (code) => {
      await authorised("tickets:check");

      return find(code);
    },

    /** @endpoint POST /api/v1/shop/tickets/:code/payout PayoutTicketRequest → Ticket */
    payoutTicket: async (code, pin) => {
      const active = await authorised("tickets:payout");
      const ticket = find(code);

      if (pin !== DEMO_PIN) throw new DataSourceError("INVALID_CREDENTIALS", "That PIN is not correct. Nothing was paid.");
      if (ticket.status === "PAID") throw new DataSourceError("CONFLICT", `Ticket ${ticket.code} has already been paid.`);
      if (ticket.status !== "WON" && ticket.status !== "VOID") throw new DataSourceError("CONFLICT", `Ticket ${ticket.code} is ${ticket.status.toLowerCase()} and cannot be paid.`);

      const amount = ticket.payout ?? 0;

      if (amount > state.float) throw new DataSourceError("CONFLICT", "The shop float does not cover this payout. Call the manager.");

      const t = now();
      const paid: Ticket = { ...ticket, status: "PAID", paidAt: new Date(t).toISOString() };

      replace(paid);
      ledger("TICKET_PAYOUT", -amount, active.cashier, ticket.code, t, ticket.status === "VOID" ? "Stake refunded on a void ticket" : undefined);
      commit();

      return paid;
    },

    /** @endpoint POST /api/v1/shop/tickets/:code/cancel CancelTicketRequest → Ticket */
    cancelTicket: async (code, reason) => {
      const active = await authorised("tickets:cancel");
      const ticket = find(code);
      const t = now();

      if (ticket.status !== "OPEN") throw new DataSourceError("CONFLICT", `Ticket ${ticket.code} is ${ticket.status.toLowerCase()} and cannot be cancelled.`);

      const stillOpen = ticket.selections.every((leg) => {
        const fixture = platform.fixture(leg.matchId);

        return fixture !== undefined && statusAt(fixture, t) === "BETTING_OPEN";
      });

      if (!stillOpen) throw new DataSourceError("BETTING_CLOSED", "Betting has closed on at least one selection, so this ticket can no longer be cancelled.");

      const cancelled: Ticket = { ...ticket, status: "CANCELLED", payout: 0, settledAt: new Date(t).toISOString(), selections: ticket.selections.map((l) => ({ ...l, outcome: "VOID" })) };

      replace(cancelled);
      ledger("TICKET_CANCEL", -ticket.stake, active.cashier, ticket.code, t, reason);
      commit();

      return cancelled;
    },

    /** @endpoint GET /api/v1/shop/transactions?date= → { items: ShopTransaction[] } */
    listTransactions: async (date) => {
      await authorised("transactions:read");

      const today = toLocalDateKey(new Date(now()));
      const wanted = date ?? today;

      if (wanted < today && !state.transactions.some((x) => toLocalDateKey(new Date(x.createdAt)) === wanted)) return pastLedger(wanted);

      return state.transactions.filter((x) => toLocalDateKey(new Date(x.createdAt)) === wanted).reverse();
    },

    /** @endpoint GET /api/v1/shop/reports/daily?date= → ShopDailyReport */
    getDailyReport: async (date) => {
      await authorised("reports:read");

      return report(date ?? toLocalDateKey(new Date(now())));
    },

    /** @endpoint GET /api/v1/shop/reports/daily/range?from=&to= → { items: ShopDailyReport[] } */
    listDailyReports: async (from, to) => {
      await authorised("reports:read");

      const days: ShopDailyReport[] = [];

      for (let day = new Date(`${from}T12:00:00`); toLocalDateKey(day) <= to && days.length < 62; day = new Date(day.getTime() + 86_400_000)) days.push(report(toLocalDateKey(day)));

      return days;
    },

    /** @endpoint GET /api/v1/shop/cashiers → { items: Cashier[] } */
    listCashiers: async () => {
      const active = await authorised("cashiers:read");

      return CASHIERS.map((c) => (c.id === active.cashier.id ? active.cashier : c));
    },

    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
}
