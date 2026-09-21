import { API_PREFIX } from "@betng/contracts/runtime";
import {
  accountDeletionSchema,
  accountSessionSchema,
  backupCodesSchema,
  bankAccountSchema,
  bankAccountVerificationSchema,
  bankSchema,
  channelPreferencesSchema,
  depositInitiationSchema,
  identityCheckResultSchema,
  kycDocumentSchema,
  kycOverviewSchema,
  kycUploadTicketSchema,
  limitHistoryEntrySchema,
  limitsSummarySchema,
  paymentRecordSchema,
  pushDeviceSchema,
  selfExclusionSchema,
  sessionRefreshSchema,
  statementJobSchema,
  twoFactorEnrollmentSchema,
  twoFactorStatusSchema,
  withdrawalQuoteSchema,
  type AccountDeletion,
  type AccountDeletionRequest,
  type AccountSession,
  type BackupCodes,
  type Bank,
  type BankAccount,
  type BankAccountVerification,
  type BankAccountVerifyRequest,
  type BvnVerifyRequest,
  type ChannelPreferences,
  type DepositInitiateRequest,
  type DepositInitiation,
  type IdentityCheckResult,
  type KycDocument,
  type KycOverview,
  type KycUploadRequest,
  type KycUploadTicket,
  type LimitHistoryEntry,
  type LimitKind,
  type LimitsSummary,
  type NinVerifyRequest,
  type PasswordChangeRequest,
  type PaymentHistoryQuery,
  type PaymentRecord,
  type PushDevice,
  type RegisterPushDeviceRequest,
  type SaveBankAccountRequest,
  type SelfExcludeRequest,
  type SelfExclusion,
  type SessionRefresh,
  type SetLimitRequest,
  type StatementJob,
  type StatementRequest,
  type TwoFactorConfirmRequest,
  type TwoFactorDisableRequest,
  type TwoFactorEnrollment,
  type TwoFactorStatus,
  type WithdrawalQuote,
  type WithdrawalRequest,
} from "@betng/contracts";
import { buildQuery, type Requester } from "./request.js";
import { validated, validatedList, validatedPage, type PageShape } from "./validated.js";

export interface IdempotentOptions {
  /** Kept by the caller for one logical operation and re-sent on every retry of it. */
  readonly idempotencyKey: string;
}

export interface BetNgPaymentsClient {
  initiateDeposit(request: DepositInitiateRequest, options: IdempotentOptions): Promise<DepositInitiation>;
  verifyDeposit(reference: string): Promise<PaymentRecord>;
  listHistory(query?: PaymentHistoryQuery): Promise<PageShape<PaymentRecord>>;
  quoteWithdrawal(request: WithdrawalRequest): Promise<WithdrawalQuote>;
  requestWithdrawal(request: WithdrawalRequest, options: IdempotentOptions): Promise<PaymentRecord>;
  getWithdrawal(reference: string): Promise<PaymentRecord>;
  listBanks(): Promise<readonly Bank[]>;
  verifyBankAccount(request: BankAccountVerifyRequest): Promise<BankAccountVerification>;
  saveBankAccount(request: SaveBankAccountRequest): Promise<BankAccount>;
  listBankAccounts(): Promise<readonly BankAccount[]>;
  setDefaultBankAccount(id: string): Promise<BankAccount>;
  deleteBankAccount(id: string): Promise<void>;
}

export interface BetNgKycClient {
  getOverview(): Promise<KycOverview>;
  listDocuments(): Promise<readonly KycDocument[]>;
  createUpload(request: KycUploadRequest): Promise<KycUploadTicket>;
  submitDocument(uploadId: string): Promise<KycDocument>;
  verifyBvn(request: BvnVerifyRequest): Promise<IdentityCheckResult>;
  verifyNin(request: NinVerifyRequest): Promise<IdentityCheckResult>;
}

export interface BetNgLimitsClient {
  getSummary(): Promise<LimitsSummary>;
  setLimit(request: SetLimitRequest): Promise<LimitsSummary>;
  removeLimit(kind: LimitKind): Promise<LimitsSummary>;
  selfExclude(request: SelfExcludeRequest): Promise<SelfExclusion>;
  cancelSelfExclusion(): Promise<SelfExclusion>;
  listHistory(): Promise<readonly LimitHistoryEntry[]>;
}

export interface BetNgSecurityClient {
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
  requestDeletion(request: AccountDeletionRequest, options: IdempotentOptions): Promise<AccountDeletion>;
  cancelDeletion(): Promise<AccountDeletion>;
  createStatement(request: StatementRequest): Promise<StatementJob>;
  getStatement(id: string): Promise<StatementJob>;
}

export interface BetNgDevicesClient {
  getChannelPreferences(): Promise<ChannelPreferences>;
  setChannelPreferences(preferences: ChannelPreferences["channels"]): Promise<ChannelPreferences>;
  listPushDevices(): Promise<readonly PushDevice[]>;
  registerPushDevice(request: RegisterPushDeviceRequest): Promise<PushDevice>;
  unregisterPushDevice(id: string): Promise<void>;
}

export interface BetNgAccountClient {
  readonly payments: BetNgPaymentsClient;
  readonly kyc: BetNgKycClient;
  readonly limits: BetNgLimitsClient;
  readonly security: BetNgSecurityClient;
  readonly devices: BetNgDevicesClient;
}

const id = (value: string): string => encodeURIComponent(value);

export function createAccountClient(request: Requester): BetNgAccountClient {
  const payments = `${API_PREFIX}/payments`;
  const kyc = `${API_PREFIX}/kyc`;
  const limits = `${API_PREFIX}/limits`;
  const account = `${API_PREFIX}/account`;
  const notifications = `${API_PREFIX}/notifications`;

  return {
    payments: {
      initiateDeposit: async (body, options) => validated(depositInitiationSchema, await request("POST", `${payments}/deposit/initiate`, body, options)),
      verifyDeposit: async (reference) => validated(paymentRecordSchema, await request("POST", `${payments}/deposit/verify`, { reference })),
      listHistory: async (query = {}) =>
        validatedPage(
          paymentRecordSchema,
          await request("GET", `${payments}/history${buildQuery({ page: query.page?.toString(), pageSize: query.pageSize?.toString(), direction: query.direction, status: query.status })}`),
        ),
      quoteWithdrawal: async (body) => validated(withdrawalQuoteSchema, await request("POST", `${payments}/withdraw/quote`, body)),
      requestWithdrawal: async (body, options) => validated(paymentRecordSchema, await request("POST", `${payments}/withdraw/request`, body, options)),
      getWithdrawal: async (reference) => validated(paymentRecordSchema, await request("GET", `${payments}/withdraw/status/${id(reference)}`)),
      listBanks: async () => validatedList(bankSchema, await request("GET", `${payments}/banks`)),
      verifyBankAccount: async (body) => validated(bankAccountVerificationSchema, await request("POST", `${payments}/bank-accounts/verify`, body)),
      saveBankAccount: async (body) => validated(bankAccountSchema, await request("POST", `${payments}/bank-accounts`, body)),
      listBankAccounts: async () => validatedList(bankAccountSchema, await request("GET", `${payments}/bank-accounts`)),
      setDefaultBankAccount: async (accountId) => validated(bankAccountSchema, await request("POST", `${payments}/bank-accounts/${id(accountId)}/default`)),
      deleteBankAccount: async (accountId) => {
        await request("DELETE", `${payments}/bank-accounts/${id(accountId)}`);
      },
    },
    kyc: {
      getOverview: async () => validated(kycOverviewSchema, await request("GET", `${kyc}/status`)),
      listDocuments: async () => validatedList(kycDocumentSchema, await request("GET", `${kyc}/documents`)),
      createUpload: async (body) => validated(kycUploadTicketSchema, await request("POST", `${kyc}/documents/uploads`, body)),
      submitDocument: async (uploadId) => validated(kycDocumentSchema, await request("POST", `${kyc}/documents`, { uploadId })),
      verifyBvn: async (body) => validated(identityCheckResultSchema, await request("POST", `${kyc}/verify/bvn`, body)),
      verifyNin: async (body) => validated(identityCheckResultSchema, await request("POST", `${kyc}/verify/nin`, body)),
    },
    limits: {
      getSummary: async () => validated(limitsSummarySchema, await request("GET", `${limits}/summary`)),
      setLimit: async (body) => validated(limitsSummarySchema, await request("PUT", limits, body)),
      removeLimit: async (kind) => validated(limitsSummarySchema, await request("DELETE", `${limits}/${id(kind)}`)),
      selfExclude: async (body) => validated(selfExclusionSchema, await request("POST", `${limits}/self-exclude`, body)),
      cancelSelfExclusion: async () => validated(selfExclusionSchema, await request("DELETE", `${limits}/self-exclude`)),
      listHistory: async () => validatedList(limitHistoryEntrySchema, await request("GET", `${limits}/history`)),
    },
    security: {
      changePassword: async (body) => {
        await request("PUT", `${account}/password`, body);
      },
      getTwoFactor: async () => validated(twoFactorStatusSchema, await request("GET", `${account}/2fa`)),
      startTwoFactorEnrollment: async () => validated(twoFactorEnrollmentSchema, await request("POST", `${account}/2fa/enroll`)),
      confirmTwoFactor: async (body) => validated(backupCodesSchema, await request("POST", `${account}/2fa/confirm`, body)),
      disableTwoFactor: async (body) => validated(twoFactorStatusSchema, await request("POST", `${account}/2fa/disable`, body)),
      regenerateBackupCodes: async (code) => validated(backupCodesSchema, await request("POST", `${account}/2fa/backup-codes`, { code })),
      listSessions: async () => validatedList(accountSessionSchema, await request("GET", `${account}/sessions`)),
      revokeSession: async (sessionId) => {
        await request("DELETE", `${account}/sessions/${id(sessionId)}`);
      },
      revokeOtherSessions: async () => {
        await request("DELETE", `${account}/sessions`);
      },
      refreshSession: async () => validated(sessionRefreshSchema, await request("POST", `${API_PREFIX}/auth/session/refresh`)),
      getDeletion: async () => validated(accountDeletionSchema, await request("GET", `${account}/deletion`)),
      requestDeletion: async (body, options) => validated(accountDeletionSchema, await request("POST", `${account}/deletion`, body, options)),
      cancelDeletion: async () => validated(accountDeletionSchema, await request("DELETE", `${account}/deletion`)),
      createStatement: async (body) => validated(statementJobSchema, await request("POST", `${account}/statements`, body)),
      getStatement: async (jobId) => validated(statementJobSchema, await request("GET", `${account}/statements/${id(jobId)}`)),
    },
    devices: {
      getChannelPreferences: async () => validated(channelPreferencesSchema, await request("GET", `${notifications}/preferences`)),
      setChannelPreferences: async (channels) => validated(channelPreferencesSchema, await request("PUT", `${notifications}/preferences`, { channels })),
      listPushDevices: async () => validatedList(pushDeviceSchema, await request("GET", `${notifications}/push/devices`)),
      registerPushDevice: async (body) => validated(pushDeviceSchema, await request("POST", `${notifications}/push/register`, body)),
      unregisterPushDevice: async (deviceId) => {
        await request("DELETE", `${notifications}/push/devices/${id(deviceId)}`);
      },
    },
  };
}
