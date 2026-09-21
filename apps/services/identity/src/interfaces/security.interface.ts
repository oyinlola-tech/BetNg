import type { Logger } from "@betng/service-kit";
import type { SecurityConfig } from "../configs/index.js";
import type {
  AdminUser,
  Cashier,
  Customer,
  Session,
  SessionKind,
  Shop,
} from "../generated/prisma/client.js";
import type { ReadModelRepository } from "./readModel.interface.js";
import type { IdentityRepositories, IdentityStore, NewAuditLog } from "./repository.interface.js";

export interface PasswordHasher {
  hash(secret: string): Promise<string>;
  verify(secret: string, encoded: string): Promise<boolean>;
  /** Burns the same work as a real verification when there is no account to check against. */
  verifyAgainstNothing(secret: string): Promise<void>;
}

export interface IssuedSession {
  readonly token: string;
  readonly session: Session;
}

export interface SessionIssuer {
  issue(repositories: IdentityRepositories, kind: SessionKind, subjectId: string): Promise<IssuedSession>;
}

export interface LoginThrottle {
  /** @throws TooManyAttemptsError while the key is locked. */
  assertNotLocked(key: string): Promise<void>;
  recordFailure(key: string): Promise<void>;
  clear(key: string): Promise<void>;
}

export type AuditEntryInput = Omit<NewAuditLog, "before" | "after" | "reason" | "severity"> & {
  readonly before?: unknown;
  readonly after?: unknown;
  readonly reason?: string | undefined;
  readonly severity?: NewAuditLog["severity"];
};

export interface AuditWriter {
  /** Redacts and appends. Pass the transaction's repositories to commit the entry with the change it records. */
  write(repositories: IdentityRepositories, entry: AuditEntryInput): Promise<string>;
}

/** The admin performing a mutating route, as the gateway asserted it. */
export interface AdminActor {
  readonly id: string;
  readonly role: string;
  readonly name: string;
  readonly requestId: string;
}

export type ResolvedSession =
  | { readonly kind: "CUSTOMER"; readonly session: Session; readonly customer: Customer }
  | { readonly kind: "CASHIER"; readonly session: Session; readonly cashier: Cashier; readonly shop: Shop }
  | { readonly kind: "ADMIN"; readonly session: Session; readonly admin: AdminUser };

export interface SessionResolver {
  /**
   * Resolves a bearer token to its live session and subject.
   *
   * @throws UnauthenticatedError for an unknown or revoked token, SessionExpiredError for an expired
   * one, AccountSuspendedError when the subject (or a cashier's shop) is suspended.
   */
  resolve(token: string): Promise<ResolvedSession>;
  /** As `resolve`, and the token must belong to `kind`; any other kind is unauthenticated here. */
  resolveAs<K extends SessionKind>(token: string | undefined, kind: K): Promise<Extract<ResolvedSession, { kind: K }>>;
}

export interface IssuedVerification {
  readonly expiresAt: Date;
}

export interface VerificationIssuer {
  issue(repositories: IdentityRepositories, customer: Customer, requestId: string): Promise<IssuedVerification>;
}

export interface HandlerDependencies {
  readonly store: IdentityStore;
  readonly readModel: ReadModelRepository;
  readonly hasher: PasswordHasher;
  readonly sessions: SessionIssuer;
  readonly resolver: SessionResolver;
  readonly throttle: LoginThrottle;
  readonly audit: AuditWriter;
  readonly verifications: VerificationIssuer;
  readonly security: SecurityConfig;
  readonly logger: Logger;
}
