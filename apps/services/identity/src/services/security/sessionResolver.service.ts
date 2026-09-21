import { SECURITY } from "../../constants/index.js";
import {
  AccountSuspendedError,
  SessionExpiredError,
  UnauthenticatedError,
} from "../../errors/index.js";
import type { SessionKind } from "../../generated/prisma/client.js";
import type { IdentityStore, ResolvedSession, SessionResolver } from "../../interfaces/index.js";
import { sha256Hex } from "../../utils/index.js";

export function createSessionResolver(store: IdentityStore): SessionResolver {
  const resolve = async (token: string): Promise<ResolvedSession> => {
    const session = await store.sessions.findByTokenHash(sha256Hex(token));

    if (session === undefined || session.revokedAt !== null) {
      throw new UnauthenticatedError();
    }

    const now = new Date();

    if (session.expiresAt <= now) {
      throw new SessionExpiredError();
    }

    // At most one write a minute per session, however often the gateway asks.
    const stale = new Date(now.getTime() - SECURITY.SESSION_TOUCH_INTERVAL_MS);

    if (session.kind === "CUSTOMER") {
      const customer = await store.customers.findById(session.subjectId);

      if (customer === undefined) {
        throw new UnauthenticatedError();
      }

      if (customer.status !== "ACTIVE") {
        throw new AccountSuspendedError();
      }

      await Promise.all([
        store.sessions.touch(session.id, now, stale),
        store.customers.touchActive(customer.id, now, stale),
      ]);

      return { kind: "CUSTOMER", session, customer };
    }

    if (session.kind === "CASHIER") {
      const cashier = await store.cashiers.findById(session.subjectId);
      const shop = cashier === undefined ? undefined : await store.shops.findById(cashier.shopId);

      if (cashier === undefined || shop === undefined) {
        throw new UnauthenticatedError();
      }

      if (cashier.status !== "ACTIVE") {
        throw new AccountSuspendedError();
      }

      if (shop.status === "SUSPENDED") {
        throw new AccountSuspendedError("This shop has been suspended.");
      }

      await Promise.all([
        store.sessions.touch(session.id, now, stale),
        store.cashiers.touchActive(cashier.id, now, stale),
      ]);

      return { kind: "CASHIER", session, cashier, shop };
    }

    const admin = await store.admins.findById(session.subjectId);

    if (admin === undefined) {
      throw new UnauthenticatedError();
    }

    if (admin.status !== "ACTIVE") {
      throw new AccountSuspendedError();
    }

    await store.sessions.touch(session.id, now, stale);

    return { kind: "ADMIN", session, admin };
  };

  return {
    resolve,
    resolveAs: async <K extends SessionKind>(token: string | undefined, kind: K) => {
      if (token === undefined) {
        throw new UnauthenticatedError();
      }

      const resolved = await resolve(token);

      if (resolved.kind !== kind) {
        throw new UnauthenticatedError();
      }

      return resolved as Extract<ResolvedSession, { kind: K }>;
    },
  };
}
