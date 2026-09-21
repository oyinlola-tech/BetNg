import type { BetNgRestClient } from "@betng/client-sdk";
import type { AdminSession, CustomerSession, ShopSession } from "@betng/contracts";
import type { AdminDataSource } from "../adminDataSource.type.js";
import type { AuthDataSource } from "../authDataSource.type.js";
import type { ShopDataSource } from "../shopDataSource.type.js";
import type { SessionLike, SessionStore } from "../session.js";
import { DataSourceError } from "../dataSource.type.js";
import { translateApiError } from "./errors.js";

function guarded<S extends SessionLike>(session: SessionStore<S>) {
  return async function run<T>(call: () => Promise<T>): Promise<T> {
    const hadSession = session.token() !== undefined;

    try {
      return await call();
    } catch (cause) {
      const error = translateApiError(cause, hadSession);

      if (error.code === "SESSION_EXPIRED") session.expire();

      throw error;
    }
  };
}

async function signOut<S extends SessionLike>(session: SessionStore<S>, call: () => Promise<void>): Promise<void> {
  try {
    await call();
  } catch {
    /* the token is dropped either way */
  }

  session.clear();
}

export function createPlatformAuthSource(rest: BetNgRestClient, session: SessionStore<CustomerSession>): AuthDataSource {
  const run = guarded(session);

  return {
    session,
    register: (request) => run(() => rest.auth.register(request)),
    verify: async (request) => {
      const next = await run(() => rest.auth.verify(request));

      session.set(next);

      return next;
    },
    resendVerification: (email) => run(() => rest.auth.resendVerification(email)),
    login: async (request) => {
      const next = await run(() => rest.auth.login(request));

      session.set(next);

      return next;
    },
    logout: () => signOut(session, () => rest.auth.logout()),
    requestPasswordReset: (email) => run(() => rest.auth.requestPasswordReset(email)),
  };
}

export function createPlatformShopSource(rest: BetNgRestClient, session: SessionStore<ShopSession>): ShopDataSource {
  const run = guarded(session);
  const listeners = new Set<() => void>();
  const notify = (): void => {
    for (const listener of listeners) listener();
  };

  // The float lives on the session's shop, so a sale, payout or cancellation re-reads it; a failure here never fails the action that succeeded.
  const changed = <T>(value: T): T => {
    notify();
    void rest.shop
      .session()
      .then((next) => {
        if (session.token() !== undefined) session.set({ ...next, token: next.token || (session.token() as string) });
        notify();
      })
      .catch(() => undefined);

    return value;
  };

  return {
    session,
    login: async (request) => {
      const next = await run(() => rest.shop.login(request));

      session.set(next);

      return next;
    },
    logout: () => signOut(session, () => rest.shop.logout()),
    placeTicket: async (input) =>
      changed(
        await run(() =>
          rest.shop.placeTicket({
            selections: input.selections.map((s) => ({ matchId: s.matchId, marketId: s.marketId, selectionId: s.selectionId, odds: s.odds })),
            stake: input.stake,
            ...(input.customerName === undefined ? {} : { customerName: input.customerName }),
            ...(input.customerPhone === undefined ? {} : { customerPhone: input.customerPhone }),
          }),
        ),
      ),
    listTickets: (filter = {}) => run(() => rest.shop.listTickets(filter)),
    getTicket: (code) => run(() => rest.shop.getTicket(code)),
    payoutTicket: async (code, pin) => changed(await run(() => rest.shop.payoutTicket(code, { pin }))),
    cancelTicket: async (code, reason) => changed(await run(() => rest.shop.cancelTicket(code, { reason }))),
    listTransactions: (date) => run(() => rest.shop.listTransactions(date)),
    getDailyReport: (date) => run(() => rest.shop.getDailyReport(date)),
    listDailyReports: (from, to) => run(() => rest.shop.listDailyReports(from, to)),
    listCashiers: () => run(() => rest.shop.listCashiers()),
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function createPlatformAdminSource(rest: BetNgRestClient, session: SessionStore<AdminSession>): AdminDataSource {
  const run = guarded(session);
  const own = new Set(["login", "logout", "session"]);
  const wrapped = Object.fromEntries(
    Object.entries(rest.admin)
      .filter(([name]) => !own.has(name))
      .map(([name, method]) => [name, (...args: unknown[]) => run(() => (method as (...a: unknown[]) => Promise<unknown>)(...args))]),
  ) as unknown as Omit<AdminDataSource, "session" | "login" | "logout" | "subscribe">;

  /** There is no cross-shop cashier route yet, so that one list is gathered per shop. */
  const queryList: AdminDataSource["queryList"] = async (resource, query = {}) => {
    if (resource !== "cashiers") return run(() => rest.admin.queryList(resource, query));

    try {
      return await run(() => rest.admin.queryList(resource, query));
    } catch (cause) {
      if (!(cause instanceof DataSourceError) || cause.code !== "NOT_FOUND") throw cause;
    }

    const shops = await run(() => rest.admin.listShops());
    const all = (await Promise.all(shops.map((shop) => run(() => rest.admin.listCashiers(shop.id))))).flat();
    const needle = query.search?.trim().toLowerCase() ?? "";
    const filters = Object.entries(query.filters ?? {}).filter(([, value]) => value !== undefined && value !== "");
    const rows = all.filter(
      (row) =>
        (needle === "" || Object.values(row).join(" ").toLowerCase().includes(needle)) &&
        filters.every(([key, value]) => !(key in row) || String((row as Record<string, unknown>)[key]) === value),
    );
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;

    return { items: rows.slice((page - 1) * pageSize, page * pageSize), page, pageSize, total: rows.length } as never;
  };

  return {
    ...wrapped,
    queryList,
    session,
    login: async (request) => {
      const next = await run(() => rest.admin.login(request));

      session.set(next);

      return next;
    },
    logout: () => signOut(session, () => rest.admin.logout()),
    subscribe: () => () => undefined,
  };
}
