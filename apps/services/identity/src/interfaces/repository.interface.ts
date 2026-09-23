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
  ShopApplication as ShopApplicationRow,
  ShopApplicationDocument as ShopApplicationDocumentRow,
  ShopApplicationDocumentType,
  ShopApplicationStatus,
  ShopApplicationVerification as ShopApplicationVerificationRow,
  ShopRole,
  ShopStatus,
} from "../generated/prisma/client.js";
import type {
  ChannelRepository,
  ClientLabels,
  DeletionRepository,
  KycRepository,
  LimitsRepository,
  PasswordRepository,
  SessionListing,
  TwoFactorRepository,
} from "./account.interface.js";

export interface NewCustomer {
  readonly email: string;
  readonly displayName: string;
  readonly phone: string | undefined;
  readonly passwordHash: string;
  readonly emailVerifiedAt?: Date;
}

export interface CustomerProfileChanges {
  readonly displayName?: string;
  readonly phone?: string;
}

export interface CustomerRepository {
  findByEmail(email: string): Promise<Customer | undefined>;
  findById(id: string): Promise<Customer | undefined>;
  create(customer: NewCustomer): Promise<Customer>;
  remove(id: string): Promise<void>;
  markVerified(id: string, at: Date): Promise<Customer>;
  setStatus(id: string, status: AccountStatus): Promise<Customer>;
  updateProfile(id: string, changes: CustomerProfileChanges): Promise<Customer>;
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
  purgeOlderThan(before: Date): Promise<number>;
}

export interface NewAdminUser {
  readonly email: string;
  readonly name: string;
  readonly role: AdminRole;
  readonly passwordHash: string;
  readonly totpSecret: string | undefined;
  /** Set together: a one-time password that stops working, and sign-in refused until it is replaced. */
  readonly mustChangePassword?: boolean;
  readonly credentialsExpireAt?: Date;
  /** Only the bootstrap step sets this, and the database allows at most one row to carry it. */
  readonly isBootstrap?: boolean;
}

export interface AdminUserChanges {
  readonly name?: string;
  readonly role?: AdminRole;
  readonly status?: "ACTIVE" | "SUSPENDED";
}

export interface AdminUserRepository {
  count(): Promise<number>;
  countSuperAdmins(): Promise<number>;
  list(limit: number): Promise<readonly AdminUser[]>;
  /** How many super administrators could still sign in if this one stopped being one. */
  countOtherActiveSuperAdmins(excludingId: string): Promise<number>;
  findByEmail(email: string): Promise<AdminUser | undefined>;
  findById(id: string): Promise<AdminUser | undefined>;
  create(admin: NewAdminUser): Promise<AdminUser>;
  update(id: string, changes: AdminUserChanges): Promise<AdminUser>;
  /** Replaces the password and clears the one-time flags in one write. */
  setPassword(id: string, passwordHash: string): Promise<AdminUser>;
  /** Issues a fresh one-time password and clears the authenticator, sending the account back to activation. */
  resetCredentials(id: string, passwordHash: string, expiresAt: Date): Promise<AdminUser>;
  recordLogin(id: string, at: Date): Promise<AdminUser>;
  /** Stores an already sealed TOTP secret and switches two-factor on. */
  enrolTotp(id: string, sealedSecret: string): Promise<AdminUser>;
  /** Stores a sealed secret the account has not proven yet; two-factor stays off until it does. */
  stagePendingTotp(id: string, sealedSecret: string): Promise<AdminUser>;
  /**
   * Ends activation: the chosen password replaces the issued one, the staged secret becomes the live one
   * and the one-time flags are cleared. The used time step is deliberately left alone, so the code that
   * activated cannot then open a second session.
   */
  completeActivation(id: string, passwordHash: string): Promise<AdminUser>;
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

export interface NewShopApplication {
  readonly reference: string;
  readonly applicantName: string;
  readonly applicantEmail: string;
  readonly applicantPhone: string;
  readonly businessName: string;
  readonly rcNumber: string | undefined;
  readonly address: string;
  readonly city: string;
  readonly state: string;
  readonly proposedShopName: string;
  readonly note: string | undefined;
}

export interface ShopApplicationDecisionInput {
  readonly status: "APPROVED" | "REJECTED" | "REQUIRES_ACTION";
  readonly reason: string;
  readonly decidedBy: string;
  readonly decidedAt: Date;
  /** Only ever set alongside APPROVED; the database refuses the pair any other way. */
  readonly shopId?: string;
}

export interface NewShopApplicationDocument {
  readonly applicationId: string;
  readonly type: ShopApplicationDocumentType;
  readonly fileName: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly objectKey: string;
}

export interface ShopApplicationRepository {
  findByReference(reference: string): Promise<ShopApplicationRow | undefined>;
  findById(id: string): Promise<ShopApplicationRow | undefined>;
  findLive(email: string): Promise<ShopApplicationRow | undefined>;
  list(status: ShopApplicationStatus | undefined, limit: number): Promise<readonly ShopApplicationRow[]>;
  create(application: NewShopApplication): Promise<ShopApplicationRow>;
  markEmailVerified(id: string, at: Date): Promise<void>;
  /**
   * Decides an application only while it is still open, and answers false when it was not — so two
   * reviewers racing cannot both decide, and neither can revisit a final one.
   */
  decideIfOpen(id: string, decision: ShopApplicationDecisionInput): Promise<boolean>;
  listDocuments(applicationId: string): Promise<readonly ShopApplicationDocumentRow[]>;
  addDocument(document: NewShopApplicationDocument): Promise<ShopApplicationDocumentRow>;
}

export interface ShopApplicationVerificationRepository {
  invalidateOutstanding(applicationId: string, at: Date): Promise<void>;
  create(verification: { readonly id: string; readonly applicationId: string; readonly codeHash: string; readonly expiresAt: Date }): Promise<void>;
  findLatest(applicationId: string): Promise<ShopApplicationVerificationRow | undefined>;
  /** Counts the guess before comparing it, in one conditional update, so parallel guesses cannot exceed the cap. */
  claimAttempt(id: string, maxAttempts: number): Promise<ShopApplicationVerificationRow | undefined>;
  consume(id: string, at: Date): Promise<void>;
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

export interface NewSession extends ClientLabels {
  readonly kind: SessionKind;
  readonly subjectId: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
}

export interface SessionRepository extends SessionListing {
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
  readonly shopApplications: ShopApplicationRepository;
  readonly shopApplicationVerifications: ShopApplicationVerificationRepository;
  readonly cashiers: CashierRepository;
  readonly sessions: SessionRepository;
  readonly throttles: ThrottleRepository;
  readonly audit: AuditLogRepository;
  readonly settings: SettingsRepository;
  readonly notifications: NotificationRepository;
  readonly twoFactor: TwoFactorRepository;
  readonly passwords: PasswordRepository;
  readonly deletions: DeletionRepository;
  readonly channels: ChannelRepository;
  readonly kyc: KycRepository;
  readonly limits: LimitsRepository;
}

export interface IdentityStore extends IdentityRepositories {
  transaction<T>(work: (repositories: IdentityRepositories) => Promise<T>): Promise<T>;
}
