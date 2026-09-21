import type { CustomerProfile, CustomerSession, UserId } from "@betng/contracts";
import { DataSourceError, createSessionStore, type AuthDataSource } from "@betng/ui-core";
import { secondFactorGateFor } from "../account/index.js";
import type { KeyValueStorage } from "../engine.js";
import { hash, uuidFrom } from "../prng.js";

export interface MockAuthOptions {
  readonly storage?: KeyValueStorage & { remove?(key: string): void };
  readonly latencyMs?: number;
  readonly now?: () => number;
  readonly isOnline?: () => boolean;
}

interface StoredAccount {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly phone?: string;
  readonly salt: string;
  /** FNV-1a over salt + password. A stand-in only: the platform uses a real password hash. */
  readonly passwordHash: string;
  readonly verified: boolean;
  readonly createdAt: string;
}

const ACCOUNTS_KEY = "betng.mock.accounts.v1";
const SESSION_KEY = "betng.session.customer";
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const VERIFY_MS = 15 * 60 * 1000;
const LOCK_MS = 30_000;
const MAX_FAILURES = 5;

export const MOCK_VERIFICATION_CODE = "123456";
export const MOCK_DEMO_CUSTOMER = Object.freeze({ email: "demo@betng.test", password: "betng-demo" });

const digest = (salt: string, password: string): string => hash(`${salt}:${password}`).toString(16);

const DEMO_ACCOUNT: StoredAccount = {
  id: "11111111-1111-4111-8111-111111111111",
  email: MOCK_DEMO_CUSTOMER.email,
  displayName: "Chidi Okafor",
  phone: "+234 803 555 0142",
  salt: "betng",
  passwordHash: digest("betng", MOCK_DEMO_CUSTOMER.password),
  verified: true,
  createdAt: "2026-08-01T09:00:00.000Z",
};

export function createMockAuthSource(options: MockAuthOptions = {}): AuthDataSource {
  const now = options.now ?? (() => Date.now());
  const latencyMs = options.latencyMs ?? 450;
  const storage = options.storage;
  const session = createSessionStore<CustomerSession>(SESSION_KEY, storage, now);

  let failures = 0;
  let lockedUntil = 0;
  const challenges = new Map<string, { accountEmail: string; expiresAt: number; attempts: number }>();

  const load = (): StoredAccount[] => {
    try {
      const raw = storage?.get(ACCOUNTS_KEY);
      const saved = typeof raw === "string" && raw !== "" ? (JSON.parse(raw) as StoredAccount[]) : [];

      return [DEMO_ACCOUNT, ...saved.filter((a) => a.email !== DEMO_ACCOUNT.email)];
    } catch {
      return [DEMO_ACCOUNT];
    }
  };

  let accounts = load();

  const persist = (): void => {
    storage?.set(ACCOUNTS_KEY, JSON.stringify(accounts.filter((a) => a.email !== DEMO_ACCOUNT.email)));
  };

  const find = (email: string): StoredAccount | undefined => accounts.find((a) => a.email === email.trim().toLowerCase());

  async function call<T>(work: () => T): Promise<T> {
    await new Promise((resolve) => setTimeout(resolve, latencyMs));

    if (options.isOnline?.() === false) throw new DataSourceError("NETWORK", "The platform could not be reached.");

    return work();
  }

  const open = (account: StoredAccount): CustomerSession => {
    const at = now();
    const user: CustomerProfile = {
      id: account.id as UserId,
      email: account.email,
      displayName: account.displayName,
      ...(account.phone === undefined ? {} : { phone: account.phone }),
      status: "ACTIVE",
      createdAt: account.createdAt,
      lastActiveAt: new Date(at).toISOString(),
    };
    const next: CustomerSession = {
      token: `mock.${uuidFrom(`${account.id}:${String(at)}`)}`,
      expiresAt: new Date(at + SESSION_MS).toISOString(),
      user,
    };

    session.set(next);

    return next;
  };

  return {
    session,

    /** @endpoint POST /api/v1/auth/register → RegistrationPending */
    register: (request) =>
      call(() => {
        const email = request.email.trim().toLowerCase();

        if (find(email) !== undefined) throw new DataSourceError("CONFLICT", "An account with that email already exists. Log in instead.");

        const salt = uuidFrom(`${email}:${String(now())}`).slice(0, 8);

        accounts = [
          ...accounts,
          {
            id: uuidFrom(`customer:${email}`),
            email,
            displayName: request.displayName.trim(),
            ...(request.phone === undefined || request.phone === "" ? {} : { phone: request.phone }),
            salt,
            passwordHash: digest(salt, request.password),
            verified: false,
            createdAt: new Date(now()).toISOString(),
          },
        ];
        persist();

        return { email, verificationRequired: true as const, expiresAt: new Date(now() + VERIFY_MS).toISOString() };
      }),

    /** @endpoint POST /api/v1/auth/verify → CustomerSession */
    verify: (request) =>
      call(() => {
        const account = find(request.email);

        if (account === undefined) throw new DataSourceError("NOT_FOUND", "There is no pending registration for that email.");
        if (request.code !== MOCK_VERIFICATION_CODE) throw new DataSourceError("VALIDATION", "That code is not right. Check it and try again.");

        const verified = { ...account, verified: true };

        accounts = accounts.map((a) => (a.email === account.email ? verified : a));
        persist();

        return open(verified);
      }),

    /** @endpoint POST /api/v1/auth/verify/resend → 204 */
    resendVerification: (email) =>
      call(() => {
        if (find(email) === undefined) throw new DataSourceError("NOT_FOUND", "There is no pending registration for that email.");
      }),

    /** @endpoint POST /api/v1/auth/login → CustomerSession */
    login: (request) =>
      call(() => {
        if (now() < lockedUntil) throw new DataSourceError("RATE_LIMITED", "Too many attempts. Wait a moment before trying again.");

        const account = find(request.email);

        if (account === undefined || account.passwordHash !== digest(account.salt, request.password)) {
          failures += 1;

          if (failures >= MAX_FAILURES) {
            failures = 0;
            lockedUntil = now() + LOCK_MS;
          }

          throw new DataSourceError("INVALID_CREDENTIALS", "Those details do not match an account.");
        }

        failures = 0;

        if (!account.verified) throw new DataSourceError("CONFLICT", "This email has not been verified yet.");

        if (secondFactorGateFor(session)?.required(account.id) === true) {
          const challengeId = uuidFrom(`challenge:${account.id}:${String(now())}`);
          const expiresAt = now() + 5 * 60_000;

          challenges.set(challengeId, { accountEmail: account.email, expiresAt, attempts: 0 });
          throw new DataSourceError("TWO_FACTOR_REQUIRED", "Enter the code from your authenticator app.", {
            challenge: { challengeId, methods: ["TOTP", "BACKUP_CODE"], expiresAt: new Date(expiresAt).toISOString() },
          });
        }

        return open(account);
      }),

    /** @endpoint POST /api/v1/auth/login/2fa { challengeId, code } → CustomerSession */
    completeTwoFactor: (request) =>
      call(() => {
        const challenge = challenges.get(request.challengeId);
        const account = challenge === undefined ? undefined : find(challenge.accountEmail);

        if (challenge === undefined || account === undefined || challenge.expiresAt < now()) {
          throw new DataSourceError("SESSION_EXPIRED", "That sign-in attempt expired. Sign in again.");
        }

        challenge.attempts += 1;
        if (challenge.attempts > 5) {
          challenges.delete(request.challengeId);
          throw new DataSourceError("RATE_LIMITED", "Too many attempts. Sign in again.");
        }

        if (secondFactorGateFor(session)?.verify(account.id, request.code) !== true) {
          throw new DataSourceError("VALIDATION", "That code is not right.", { fields: { code: "That code is not right." } });
        }

        challenges.delete(request.challengeId);

        return open(account);
      }),

    /** @endpoint POST /api/v1/auth/logout → 204 */
    logout: async () => {
      await new Promise((resolve) => setTimeout(resolve, Math.min(latencyMs, 150)));
      session.clear();
    },

    /** @endpoint POST /api/v1/auth/password/forgot → 204 (always, whether or not the address exists) */
    requestPasswordReset: () => call(() => undefined),

    /** @endpoint POST /api/v1/auth/password/reset { email, code, newPassword } → 204 (revokes every session) */
    confirmPasswordReset: (request) =>
      call(() => {
        const account = find(request.email);

        if (account === undefined || request.code !== MOCK_VERIFICATION_CODE) throw new DataSourceError("VALIDATION", "That code is not right or has expired.", { fields: { code: "That code is not right or has expired." } });

        const salt = uuidFrom(`${account.email}:${String(now())}`).slice(0, 8);
        const updated = { ...account, salt, passwordHash: digest(salt, request.newPassword) };

        accounts = accounts.map((a) => (a.email === account.email ? updated : a));
        persist();
      }),
  };
}
