import type { AuditSeverity, PlatformSettings } from "@betng/contracts";
import type {
  AccountStatus,
  AdminRole,
  AdminUser,
  AuditLog,
  Cashier,
  Customer,
  EmailVerification,
  LoginThrottle,
  Notification,
  Session,
  SessionKind,
  Shop,
  ShopRole,
  ShopStatus,
} from "../generated/prisma/client.js";

export interface NewCustomer {
  readonly email: string;
  readonly displayName: string;
  readonly phone: string | undefined;
  readonly passwordHash: string;
  readonly emailVerifiedAt?: Date;
}

export interface CustomerRepository {
  findByEmail(email: string): Promise<Customer | undefined>;
  findById(id: string): Promise<Customer | undefined>;
  create(customer: NewCustomer): Promise<Customer>;
  remove(id: string): Promise<void>;
  markVerified(id: string, at: Date): Promise<Customer>;
  setStatus(id: string, status: AccountStatus): Promise<Customer>;
  touchActive(id: string, at: Date, olderThan: Date): Promise<void>;
  search(q: string | undefined, limit: number): Promise<readonly Customer[]>;
}

export interface NewVerification {
  readonly id: string;
  readonly customerId: string;
  readonly codeHash: string;
  readonly expiresAt: Date;
}

export interface VerificationRepository {
  create(verification: NewVerification): Promise<EmailVerification>;
  findLatest(customerId: string): Promise<EmailVerification | undefined>;
  /** Counts one guess against the code. `false` when the cap was already reached or the code is spent. */
  claimAttempt(id: string, maxAttempts: number): Promise<boolean>;
  consume(id: string, at: Date): Promise<boolean>;
  invalidateOutstanding(customerId: string, at: Date): Promise<void>;
  purgeOlderThan(before: Date): Promise<number>;
}

export interface PasswordResetRepository {
  replace(customerId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  purgeOlderThan(before: Date): Promise<number>;
}

export interface NewAdminUser {
  readonly email: string;
  readonly name: string;
  readonly role: AdminRole;
  readonly passwordHash: string;
  readonly totpSecret: string | undefined;
}

export interface AdminUserRepository {
  count(): Promise<number>;
  findByEmail(email: string): Promise<AdminUser | undefined>;
  findById(id: string): Promise<AdminUser | undefined>;
  create(admin: NewAdminUser): Promise<AdminUser>;
  recordLogin(id: string, at: Date): Promise<AdminUser>;
  /** Marks a TOTP time step as used. `false` when that step, or a later one, was already used. */
  claimTotpStep(id: string, step: number): Promise<boolean>;
}

export interface ShopDetails {
  readonly code: string;
  readonly name: string;
  readonly address: string;
  readonly phone: string;
  readonly email: string;
  readonly ownerName: string;
}

export interface ShopRepository {
  findByCode(code: string): Promise<Shop | undefined>;
  findById(id: string): Promise<Shop | undefined>;
  list(limit: number): Promise<readonly Shop[]>;
  create(shop: ShopDetails): Promise<Shop>;
  update(id: string, changes: Partial<ShopDetails>): Promise<Shop>;
  setStatus(id: string, status: ShopStatus): Promise<Shop>;
}

export interface NewCashier {
  readonly shopId: string;
  readonly username: string;
  readonly displayName: string;
  readonly role: ShopRole;
  readonly passwordHash: string;
  readonly pinHash: string;
  readonly credentialsExpireAt: Date | undefined;
}

export interface ShopActivity {
  readonly shopId: string;
  readonly cashierCount: number;
  readonly lastActiveAt: Date | undefined;
}

export interface CashierRepository {
  findByShopAndUsername(shopId: string, username: string): Promise<Cashier | undefined>;
  findById(id: string): Promise<Cashier | undefined>;
  listByShop(shopId: string, limit: number): Promise<readonly Cashier[]>;
  activityByShop(shopIds: readonly string[]): Promise<readonly ShopActivity[]>;
  create(cashier: NewCashier): Promise<Cashier>;
  setStatus(id: string, status: AccountStatus): Promise<Cashier>;
  setCredentials(id: string, passwordHash: string, pinHash: string, expireAt: Date): Promise<Cashier>;
  markCredentialsUsed(id: string): Promise<void>;
  touchActive(id: string, at: Date, olderThan: Date): Promise<void>;
}

export interface NewSession {
  readonly kind: SessionKind;
  readonly subjectId: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
}

export interface SessionRepository {
  create(session: NewSession): Promise<Session>;
  findByTokenHash(tokenHash: string): Promise<Session | undefined>;
  /** Revokes one live session of the given kind. Returns it, or `undefined` when there was nothing live to revoke. */
  revokeByTokenHash(tokenHash: string, kind: SessionKind, at: Date): Promise<Session | undefined>;
  revokeForSubjects(kind: SessionKind, subjectIds: readonly string[], at: Date): Promise<number>;
  touch(id: string, at: Date, olderThan: Date): Promise<void>;
  purgeExpiredBefore(before: Date): Promise<number>;
}

export interface ThrottleRepository {
  find(keyHash: string): Promise<LoginThrottle | undefined>;
  /** Counts one failure; at `maxFailures` the key is locked until `lockUntil` and the count restarts. */
  recordFailure(keyHash: string, maxFailures: number, lockUntil: Date, at: Date): Promise<void>;
  clear(keyHash: string): Promise<void>;
  purgeOlderThan(before: Date): Promise<number>;
}

export interface NewAuditLog {
  readonly actorId: string;
  readonly actorRole: string;
  readonly actorName: string;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly before: unknown;
  readonly after: unknown;
  readonly reason: string | undefined;
  readonly severity: AuditSeverity;
  readonly requestId: string;
}

export interface AuditLogFilter {
  readonly actor?: string;
  readonly action?: string;
  readonly resource?: string;
  readonly severity?: AuditSeverity;
  readonly from?: Date;
  readonly to?: Date;
  readonly page: number;
  readonly pageSize: number;
}

export interface AuditLogRepository {
  append(entry: NewAuditLog): Promise<AuditLog>;
  page(filter: AuditLogFilter): Promise<{ readonly items: readonly AuditLog[]; readonly total: number }>;
}

export interface NewNotification {
  readonly customerId: string;
  readonly kind: string;
  readonly title: string;
  readonly body: string;
  readonly data: Readonly<Record<string, unknown>> | undefined;
  readonly dedupeKey: string | undefined;
}

export interface NotificationRepository {
  /** With a `dedupeKey` already used for the customer, nothing is written and the first row comes back. */
  createOnce(
    notification: NewNotification,
  ): Promise<{ readonly notification: Notification; readonly duplicate: boolean }>;
  listForCustomer(customerId: string, limit: number): Promise<readonly Notification[]>;
  /** `ids` undefined marks every unread row. Rows of another customer never match. */
  markRead(customerId: string, ids: readonly string[] | undefined, at: Date): Promise<number>;
  purgeOlderThan(before: Date): Promise<number>;
}

export interface StoredSettings {
  readonly value: PlatformSettings;
  readonly version: number;
}

export interface SettingsRepository {
  find(): Promise<StoredSettings | undefined>;
  createIfMissing(value: PlatformSettings, updatedBy: string): Promise<void>;
  replace(expectedVersion: number, value: PlatformSettings, updatedBy: string, at: Date): Promise<boolean>;
}

export interface IdentityRepositories {
  readonly customers: CustomerRepository;
  readonly verifications: VerificationRepository;
  readonly passwordResets: PasswordResetRepository;
  readonly admins: AdminUserRepository;
  readonly shops: ShopRepository;
  readonly cashiers: CashierRepository;
  readonly sessions: SessionRepository;
  readonly throttles: ThrottleRepository;
  readonly audit: AuditLogRepository;
  readonly settings: SettingsRepository;
  readonly notifications: NotificationRepository;
}

export interface IdentityStore extends IdentityRepositories {
  transaction<T>(work: (repositories: IdentityRepositories) => Promise<T>): Promise<T>;
}
