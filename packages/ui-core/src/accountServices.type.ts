import type {
  AccountDeletion,
  AccountDeletionRequest,
  AccountSession,
  BackupCodes,
  Bank,
  BankAccount,
  BankAccountVerification,
  BankAccountVerifyRequest,
  BvnVerifyRequest,
  ChannelPreferences,
  DepositInitiateRequest,
  DepositInitiation,
  IdentityCheckResult,
  KycDocument,
  KycDocumentType,
  KycOverview,
  LimitHistoryEntry,
  LimitKind,
  LimitsSummary,
  NinVerifyRequest,
  PasswordChangeRequest,
  PaymentHistoryQuery,
  PaymentRecord,
  PushDevice,
  RegisterPushDeviceRequest,
  SelfExcludeRequest,
  SelfExclusion,
  SessionRefresh,
  SetLimitRequest,
  StatementJob,
  StatementRequest,
  TwoFactorConfirmRequest,
  TwoFactorDisableRequest,
  TwoFactorEnrollment,
  TwoFactorStatus,
  WithdrawalQuote,
  WithdrawalRequest,
} from "@betng/contracts";
import type { PageView } from "./types/index.js";

export interface UploadProgress {
  readonly loaded: number;
  readonly total: number;
}

export interface KycUploadInput {
  readonly type: KycDocumentType;
  readonly file: Blob & { readonly name: string };
  readonly onProgress?: (progress: UploadProgress) => void;
  readonly signal?: AbortSignal;
}

export interface PaymentsSource {
  initiateDeposit(request: DepositInitiateRequest, idempotencyKey: string): Promise<DepositInitiation>;
  /** Asks the platform for the payment's current state; a redirect back from the provider is never proof of anything. */
  verifyDeposit(reference: string): Promise<PaymentRecord>;
  listHistory(query?: PaymentHistoryQuery): Promise<PageView<PaymentRecord>>;
  quoteWithdrawal(request: WithdrawalRequest): Promise<WithdrawalQuote>;
  requestWithdrawal(request: WithdrawalRequest, idempotencyKey: string): Promise<PaymentRecord>;
  getWithdrawal(reference: string): Promise<PaymentRecord>;
  listBanks(): Promise<readonly Bank[]>;
  verifyBankAccount(request: BankAccountVerifyRequest): Promise<BankAccountVerification>;
  saveBankAccount(verificationId: string, makeDefault: boolean): Promise<BankAccount>;
  listBankAccounts(): Promise<readonly BankAccount[]>;
  setDefaultBankAccount(id: string): Promise<BankAccount>;
  deleteBankAccount(id: string): Promise<void>;
}

export interface KycSource {
  getOverview(): Promise<KycOverview>;
  listDocuments(): Promise<readonly KycDocument[]>;
  /** Asks the platform for a single-use upload target, sends the file there, then submits it for review. */
  uploadDocument(input: KycUploadInput): Promise<KycDocument>;
  verifyBvn(request: BvnVerifyRequest): Promise<IdentityCheckResult>;
  verifyNin(request: NinVerifyRequest): Promise<IdentityCheckResult>;
}

export interface LimitsSource {
  getSummary(): Promise<LimitsSummary>;
  setLimit(request: SetLimitRequest): Promise<LimitsSummary>;
  removeLimit(kind: LimitKind): Promise<LimitsSummary>;
  selfExclude(request: SelfExcludeRequest): Promise<SelfExclusion>;
  cancelSelfExclusion(): Promise<SelfExclusion>;
  listHistory(): Promise<readonly LimitHistoryEntry[]>;
}

export interface SecuritySource {
  changePassword(request: PasswordChangeRequest): Promise<void>;
  getTwoFactor(): Promise<TwoFactorStatus>;
  startTwoFactorEnrollment(): Promise<TwoFactorEnrollment>;
  confirmTwoFactor(request: TwoFactorConfirmRequest): Promise<BackupCodes>;
  disableTwoFactor(request: TwoFactorDisableRequest): Promise<TwoFactorStatus>;
  regenerateBackupCodes(code: string): Promise<BackupCodes>;
  listSessions(): Promise<readonly AccountSession[]>;
  revokeSession(id: string): Promise<void>;
  revokeOtherSessions(): Promise<void>;
  refreshSession(): Promise<SessionRefresh>;
  getDeletion(): Promise<AccountDeletion>;
  requestDeletion(request: AccountDeletionRequest, idempotencyKey: string): Promise<AccountDeletion>;
  cancelDeletion(): Promise<AccountDeletion>;
  createStatement(request: StatementRequest): Promise<StatementJob>;
  getStatement(id: string): Promise<StatementJob>;
}

export interface DevicesSource {
  getChannelPreferences(): Promise<ChannelPreferences>;
  setChannelPreferences(channels: ChannelPreferences["channels"]): Promise<ChannelPreferences>;
  listPushDevices(): Promise<readonly PushDevice[]>;
  registerPushDevice(request: RegisterPushDeviceRequest): Promise<PushDevice>;
  unregisterPushDevice(id: string): Promise<void>;
}

/** Customer account services behind the session: money movement, identity, limits, security and delivery channels. */
export interface AccountServicesSource {
  readonly payments: PaymentsSource;
  readonly kyc: KycSource;
  readonly limits: LimitsSource;
  readonly security: SecuritySource;
  readonly devices: DevicesSource;
}
