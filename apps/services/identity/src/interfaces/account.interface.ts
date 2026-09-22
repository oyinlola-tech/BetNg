import type {
  AccountDeletion,
  BackupCode,
  Customer,
  CustomerTwoFactor,
  IdentityCheckKind,
  KycDocument,
  KycDocumentType,
  KycIdentityCheck,
  KycProfile,
  KycStatus,
  KycUpload,
  LimitHistory,
  LoginChallenge,
  NotificationPreference,
  PasswordReset,
  PushDevice,
  PushPlatform,
  ResponsibleGamingLimit,
  SelfExclusion,
  Session,
  TwoFactorEnrollment,
} from "../generated/prisma/client.js";

export interface ClientLabels {
  readonly device?: string | undefined;
  readonly browser?: string | undefined;
  readonly platform?: string | undefined;
}

export interface NewEnrollment {
  readonly id: string;
  readonly customerId: string;
  readonly secretCiphertext: string;
  readonly expiresAt: Date;
}

export interface NewChallenge extends ClientLabels {
  readonly customerId: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
}

export interface TwoFactorRepository {
  find(customerId: string): Promise<CustomerTwoFactor | undefined>;
  enable(customerId: string, secretCiphertext: string, step: number, at: Date): Promise<CustomerTwoFactor>;
  remove(customerId: string): Promise<void>;
  /** `false` when that step, or a later one, was already used. */
  claimStep(customerId: string, step: number): Promise<boolean>;
  createEnrollment(enrollment: NewEnrollment): Promise<TwoFactorEnrollment>;
  findEnrollment(id: string): Promise<TwoFactorEnrollment | undefined>;
  claimEnrollmentAttempt(id: string, maxAttempts: number): Promise<boolean>;
  consumeEnrollment(id: string, at: Date): Promise<boolean>;
  replaceBackupCodes(customerId: string, codeHashes: readonly string[]): Promise<void>;
  countUnusedBackupCodes(customerId: string): Promise<number>;
  /** Spends the code in one conditional update. `false` when it is unknown, another customer's, or already used. */
  consumeBackupCode(customerId: string, codeHash: string, at: Date): Promise<boolean>;
  listBackupCodes(customerId: string): Promise<readonly BackupCode[]>;
  createChallenge(challenge: NewChallenge): Promise<LoginChallenge>;
  findChallenge(tokenHash: string): Promise<LoginChallenge | undefined>;
  claimChallengeAttempt(id: string, maxAttempts: number): Promise<boolean>;
  consumeChallenge(id: string, at: Date): Promise<boolean>;
  purgeOlderThan(before: Date): Promise<number>;
}

export interface PasswordRepository {
  /** Stores the new hash and keeps the one it replaces in the history. */
  change(customer: Customer, newHash: string, at: Date): Promise<void>;
  recentHashes(customerId: string, limit: number): Promise<readonly string[]>;
  replaceReset(customerId: string, id: string, codeHash: string, expiresAt: Date): Promise<void>;
  findLatestReset(customerId: string): Promise<PasswordReset | undefined>;
  claimResetAttempt(id: string, maxAttempts: number): Promise<boolean>;
  consumeReset(id: string, at: Date): Promise<boolean>;
}

export interface NewDeletion {
  readonly customerId: string;
  readonly reason: string | undefined;
  readonly idempotencyKey: string;
  readonly scheduledFor: Date;
}

export interface Anonymised {
  readonly email: string;
  readonly displayName: string;
  readonly passwordHash: string;
}

export interface DeletionRepository {
  findLatest(customerId: string): Promise<AccountDeletion | undefined>;
  findByKey(customerId: string, idempotencyKey: string): Promise<AccountDeletion | undefined>;
  create(deletion: NewDeletion): Promise<AccountDeletion>;
  cancel(id: string, at: Date): Promise<boolean>;
  due(now: Date, limit: number): Promise<readonly AccountDeletion[]>;
  complete(id: string, at: Date): Promise<boolean>;
  /** Removes personal data the platform has no duty to keep. Ledger, bet, KYC and audit records stay. */
  anonymise(customerId: string, replacement: Anonymised, at: Date): Promise<void>;
}

export interface NewPushDevice {
  readonly id: string;
  readonly customerId: string;
  readonly platform: PushPlatform;
  readonly label: string;
  readonly tokenHash: string;
  readonly tokenCiphertext: string;
  readonly sessionId: string | undefined;
}

export interface ChannelRepository {
  findPreferences(customerId: string): Promise<NotificationPreference | undefined>;
  savePreferences(customerId: string, channels: unknown, at: Date): Promise<void>;
  listDevices(customerId: string): Promise<readonly PushDevice[]>;
  /** A token already registered (by anyone) is moved to this customer and relabelled. */
  upsertDevice(device: NewPushDevice, at: Date): Promise<PushDevice>;
  removeDevice(customerId: string, id: string): Promise<boolean>;
  removeByTokenHash(tokenHash: string): Promise<void>;
  trimDevices(customerId: string, keep: number): Promise<void>;
}

export interface NewKycUpload {
  readonly id: string;
  readonly customerId: string;
  readonly type: KycDocumentType;
  readonly fileName: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly objectKey: string;
  readonly expiresAt: Date;
}

export interface NewIdentityCheck {
  readonly customerId: string;
  readonly check: IdentityCheckKind;
  readonly status: KycStatus;
  readonly numberHash: string;
  readonly numberLast4: string;
  readonly provider: string;
  readonly providerReference: string | undefined;
  readonly message: string | undefined;
}

export interface KycQueueFilter {
  readonly status: KycStatus;
  readonly search: string | undefined;
  readonly page: number;
  readonly pageSize: number;
}

export interface KycQueueEntry {
  readonly customer: Customer;
  readonly documents: readonly KycDocument[];
}

export interface KycRepository {
  createUpload(upload: NewKycUpload): Promise<KycUpload>;
  findUpload(customerId: string, id: string): Promise<KycUpload | undefined>;
  consumeUpload(id: string, at: Date): Promise<boolean>;
  countUploadsSince(customerId: string, since: Date): Promise<number>;
  createDocument(upload: KycUpload, at: Date): Promise<KycDocument>;
  listDocuments(customerId: string): Promise<readonly KycDocument[]>;
  findDocument(id: string): Promise<KycDocument | undefined>;
  hasPendingOfType(customerId: string, type: KycDocumentType): Promise<boolean>;
  /** Applies a decision to every PENDING document of the customer. Returns how many changed. */
  decidePending(customerId: string, status: KycStatus, reason: string | undefined, reviewer: string, at: Date): Promise<number>;
  recordCheck(check: NewIdentityCheck): Promise<KycIdentityCheck>;
  latestChecks(customerId: string): Promise<readonly KycIdentityCheck[]>;
  countChecksSince(customerId: string, since: Date): Promise<number>;
  verifiedElsewhere(check: IdentityCheckKind, numberHash: string, customerId: string): Promise<boolean>;
  findProfile(customerId: string): Promise<KycProfile | undefined>;
  saveProfile(customerId: string, decision: KycStatus, reason: string | undefined, reviewer: string, at: Date): Promise<void>;
  queue(filter: KycQueueFilter): Promise<{ readonly items: readonly KycQueueEntry[]; readonly total: number }>;
  purgeUploadsOlderThan(before: Date): Promise<number>;
}

export interface NewLimitHistory {
  readonly customerId: string;
  readonly kind: string;
  readonly action: "SET" | "RAISED" | "LOWERED" | "REMOVED" | "EXPIRED" | "EXCLUDED";
  readonly previousValue: bigint | undefined;
  readonly value: bigint | undefined;
  readonly at: Date;
}

export interface NewSelfExclusion {
  readonly customerId: string;
  readonly period: string;
  readonly startedAt: Date;
  readonly endsAt: Date | undefined;
  readonly canCancelAt: Date | undefined;
}

export interface ResponsibleGamingFilter {
  readonly search: string | undefined;
  readonly flag: "SELF_EXCLUDED" | "LIMIT_BREACH_ATTEMPT" | "LIMIT_RAISED" | "LONG_SESSION" | undefined;
  readonly page: number;
  readonly pageSize: number;
  readonly now: Date;
  readonly lookbackSince: Date;
  readonly longSessionBefore: Date;
  readonly activeSince: Date;
}

export interface ResponsibleGamingRow {
  readonly customer: Customer;
  readonly selfExcluded: boolean;
  readonly breachAt: Date | undefined;
  readonly raisedAt: Date | undefined;
  readonly longSessionAt: Date | undefined;
}

export interface LimitsRepository {
  list(customerId: string): Promise<readonly ResponsibleGamingLimit[]>;
  find(customerId: string, kind: string): Promise<ResponsibleGamingLimit | undefined>;
  set(customerId: string, kind: string, value: bigint, at: Date): Promise<void>;
  setPending(customerId: string, kind: string, pendingValue: bigint, effectiveAt: Date, at: Date): Promise<void>;
  scheduleRemoval(customerId: string, kind: string, effectiveAt: Date, at: Date): Promise<void>;
  /** Applies loosenings and removals whose cooling-off has ended. Returns how many rows changed. */
  settleDue(customerId: string | undefined, now: Date): Promise<number>;
  appendHistory(entry: NewLimitHistory): Promise<void>;
  history(customerId: string, limit: number): Promise<readonly LimitHistory[]>;
  activeExclusion(customerId: string, now: Date): Promise<SelfExclusion | undefined>;
  createExclusion(exclusion: NewSelfExclusion): Promise<SelfExclusion>;
  cancelExclusion(id: string, at: Date): Promise<boolean>;
  recordRefusal(customerId: string, action: string, code: string, amount: bigint, at: Date): Promise<void>;
  page(filter: ResponsibleGamingFilter): Promise<{ readonly items: readonly ResponsibleGamingRow[]; readonly total: number }>;
}

export interface PendingEviction {
  readonly id: string;
  readonly tokenHash: string;
}

export interface SessionListing {
  listLive(customerId: string, now: Date): Promise<readonly Session[]>;
  findById(id: string): Promise<Session | undefined>;
  /** Revokes one live customer session that belongs to `customerId`. */
  revokeOwned(id: string, customerId: string, at: Date): Promise<boolean>;
  /** Revokes every live customer session except `keepId`. */
  revokeOthers(customerId: string, keepId: string | undefined, at: Date): Promise<number>;
  extend(id: string, expiresAt: Date): Promise<void>;
  newestLive(customerId: string, now: Date): Promise<Session | undefined>;
  /** Whether a customer session with these client labels was opened since `since`. */
  seenClient(customerId: string, labels: ClientLabels, since: Date): Promise<boolean>;
  /** Revoked, unexpired sessions the gateway cache (or the event service) has not dropped yet, oldest first. */
  pendingEviction(now: Date, limit: number, target: "cache" | "realtime"): Promise<readonly PendingEviction[]>;
  markEvicted(ids: readonly string[], at: Date): Promise<void>;
  markRealtimeRevoked(ids: readonly string[], at: Date): Promise<void>;
}
