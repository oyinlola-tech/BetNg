import type { AdminListQuery, AdminListResource, BetNgRestClient } from "@betng/client-sdk";
import type { AdminSession, CustomerSession, ShopSession } from "@betng/contracts";
import type { AdminDataSource, ComplianceDataSource } from "../adminDataSource.type.js";
import type { AuthDataSource } from "../authDataSource.type.js";
import type { ShopDataSource } from "../shopDataSource.type.js";
import type { SessionLike, SessionStore } from "../session.js";
import { pageRows } from "../pageRows.js";
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

/** For routes still pending on the platform: a 404/405 means the service is not deployed, not that a record is missing. */
function servedOrPending(run: <T>(call: () => Promise<T>) => Promise<T>) {
  return async function call<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await run(work);
    } catch (cause) {
      const error = cause as DataSourceError;

      if (error.detail.status === 404 || error.detail.status === 405) {
        throw new DataSourceError("NOT_IMPLEMENTED", "This service is not available on the platform yet.", error.detail);
      }

      throw error;
    }
  };
}

export function createPlatformComplianceSource(rest: BetNgRestClient, session: SessionStore<AdminSession>): ComplianceDataSource {
  const call = servedOrPending(guarded(session));
  const c = rest.compliance;

  return {
    listKycQueue: (query) => call(() => c.listKycQueue(query)),
    reviewKyc: (userId, decision) => call(() => c.reviewKyc(userId, decision)),
    previewKycDocument: (documentId) => call(() => c.previewKycDocument(documentId)),
    getPaymentOverview: () => call(() => c.getPaymentOverview()),
    listPayments: (query) => call(() => c.listPayments(query)),
    reviewWithdrawal: (reference, review) => call(() => c.reviewWithdrawal(reference, review)),
    listResponsibleGaming: (query) => call(() => c.listResponsibleGaming(query)),
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
      const result = await run(() => rest.auth.login(request));

      if ("challenge" in result) {
        throw new DataSourceError("TWO_FACTOR_REQUIRED", "Enter the code from your authenticator app.", { challenge: result.challenge });
      }

      session.set(result.session);

      return result.session;
    },
    completeTwoFactor: async (request) => {
      const next = await run(() => rest.auth.completeTwoFactor(request));

      session.set(next);

      return next;
    },
    logout: () => signOut(session, () => rest.auth.logout()),
    requestPasswordReset: (email) => run(() => rest.auth.requestPasswordReset(email)),
    confirmPasswordReset: (request) => run(() => rest.auth.confirmPasswordReset(request)),
  };
}

export function createPlatformShopSource(rest: BetNgRestClient, session: SessionStore<ShopSession>): ShopDataSource {
  const run = guarded(session);
  const unserved = servedOrPending(run);
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
    shifts: {
      getCurrent: () => unserved(() => rest.shop.getCurrentShift()),
      open: async (openingFloat, key) => changed(await unserved(() => rest.shop.openShift({ openingFloat }, key))),
      recordCash: async (request, key) => changed(await unserved(() => rest.shop.recordCashMovement(request, key))),
      close: async (shiftId, request, key) => changed(await unserved(() => rest.shop.closeShift(shiftId, request, key))),
      list: (date) => unserved(() => rest.shop.listShifts(date)),
    },
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export interface PlatformAdminOptions {
  /** True once the platform pages, sorts and searches admin lists itself. */
  readonly serverPaging?: boolean;
}

export function createPlatformAdminSource(
  rest: BetNgRestClient,
  session: SessionStore<AdminSession>,
  options: PlatformAdminOptions = {},
): AdminDataSource {
  const run = guarded(session);
  const own = new Set(["login", "logout", "session"]);
  const wrapped = Object.fromEntries(
    Object.entries(rest.admin)
      .filter(([name]) => !own.has(name))
      .map(([name, method]) => [name, (...args: unknown[]) => run(() => (method as (...a: unknown[]) => Promise<unknown>)(...args))]),
  ) as unknown as Omit<AdminDataSource, "session" | "login" | "logout" | "subscribe">;

  /*
   * The platform's admin lists answer every row and refuse paging keys, so
   * until it pages them (`serverPaging`), a list is read through its own
   * route with the filters that route takes and paged here.
   */
  const unpaged = async (resource: AdminListResource, query: AdminListQuery): Promise<readonly object[]> => {
    const filters = query.filters ?? {};

    switch (resource) {
      case "users":
        return rest.admin.listCustomers(query.search);
      case "shops":
        return rest.admin.listShops();
      case "cashiers": {
        const shops = await rest.admin.listShops();

        return (await Promise.all(shops.map((shop) => rest.admin.listCashiers(shop.id)))).flat();
      }
      case "teams":
        return rest.admin.listTeams(filters["leagueId"]);
      case "fixtures":
        return rest.admin.listFixtures(filters["leagueId"] === undefined ? {} : { leagueId: filters["leagueId"] });
      case "settlements":
        return rest.admin.listSettlements(filters["status"]);
      case "simulations":
        return rest.admin.listSimulations(filters["status"]);
    }
  };

  const queryList: AdminDataSource["queryList"] = async (resource, query = {}) => {
    if (options.serverPaging === true) return run(() => rest.admin.queryList(resource, query));

    const rows = await run(() => unpaged(resource, query));
    const { search: _search, ...local } = query;

    return pageRows(rows, resource === "users" ? local : query) as never;
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
