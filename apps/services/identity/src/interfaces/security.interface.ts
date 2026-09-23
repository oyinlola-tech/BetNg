import type { Logger } from "@betng/service-kit";
import type { IdentityConfig, SecurityConfig } from "../configs/index.js";
import type {
  AdminUser,
  Cashier,
  Customer,
  Session,
  SessionKind,
  Shop,
  ShopRole,
} from "../generated/prisma/client.js";
import type { DataProtector } from "../utils/index.js";
import type { ClientLabels } from "./account.interface.js";
import type { Messenger } from "./delivery.interface.js";
import type { DocumentStorage, IdentityVerificationProvider } from "./kyc.interface.js";
import type { ReadModelRepository } from "./readModel.interface.js";
import type { IdentityRepositories, IdentityStore, NewAuditLog } from "./repository.interface.js";

export interface PasswordHasher {
  hash(secret: string): Promise<string>;
  verify(secret: string, encoded: string): Promise<boolean>;
  verifyAgainstNothing(secret: string): Promise<void>;
}

export interface IssuedSession {
  readonly token: string;
  readonly session: Session;
}

export interface SessionIssuer {
  issue(repositories: IdentityRepositories, kind: SessionKind, subjectId: string, labels?: ClientLabels): Promise<IssuedSession>;
  ttlMs(kind: SessionKind): number;
  /** Absolute lifetime of a customer session, counted from sign-in. */
  readonly maxLifetimeMs: number;
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
  /** Pass the transaction's repositories so the entry commits with the change it records. */
  write(repositories: IdentityRepositories, entry: AuditEntryInput): Promise<string>;
}

export interface AdminActor {
  readonly id: string;
  readonly role: string;
  readonly name: string;
  readonly requestId: string;
}

/** A cashier acting on their own shop. `shopId` comes from the session, never from the request. */
export interface ShopActor {
  readonly id: string;
  readonly shopId: string;
  readonly role: ShopRole;
  readonly name: string;
  readonly requestId: string;
}

export type ResolvedSession =
  | { readonly kind: "CUSTOMER"; readonly session: Session; readonly customer: Customer }
  | { readonly kind: "CASHIER"; readonly session: Session; readonly cashier: Cashier; readonly shop: Shop }
  | { readonly kind: "ADMIN"; readonly session: Session; readonly admin: AdminUser };

export interface SessionResolver {
  /** @throws UnauthenticatedError (unknown/revoked), SessionExpiredError, AccountSuspendedError (subject or its shop). */
  resolve(token: string): Promise<ResolvedSession>;
  /** A token of any other kind is unauthenticated here. */
  resolveAs<K extends SessionKind>(token: string | undefined, kind: K): Promise<Extract<ResolvedSession, { kind: K }>>;
}

export interface IssuedVerification {
  readonly expiresAt: Date;
  /** Emails the code. Call after the transaction that stored it has committed; throws when the provider refused it. */
  send(): Promise<void>;
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
  readonly protector: DataProtector;
  readonly messenger: Messenger;
  readonly evictor: { flush(): Promise<void> };
  readonly breachChecker: { isBreached(password: string): Promise<boolean> };
  /** Undefined when KYC object storage is not configured. */
  readonly storage: DocumentStorage | undefined;
  readonly identityVerifier: IdentityVerificationProvider;
  readonly kyc: IdentityConfig["kyc"];
}
