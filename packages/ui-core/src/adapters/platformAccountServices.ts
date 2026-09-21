import type { BetNgRestClient } from "@betng/client-sdk";
import { KYC_ACCEPTED_TYPES, KYC_MAX_BYTES, type CustomerSession, type KycUploadRequest } from "@betng/contracts";
import type { AccountServicesSource } from "../accountServices.type.js";
import { DataSourceError } from "../dataSource.type.js";
import type { SessionStore } from "../session.js";
import { translateApiError } from "./errors.js";
import { uploadToTicket } from "./upload.js";

export interface PlatformAccountServicesOptions {
  /** Hosts the platform may hand out as KYC upload targets. */
  readonly uploadHosts: readonly string[];
}

/*
 * Every call runs behind the customer's session. A route the gateway does
 * not serve yet answers 404/405/501; for these account routes that means the
 * service is not deployed, so screens get NOT_IMPLEMENTED rather than a
 * misleading "not found".
 */
export function createPlatformAccountServices(
  rest: BetNgRestClient,
  session: SessionStore<CustomerSession>,
  options: PlatformAccountServicesOptions,
): AccountServicesSource {
  const call = async <T>(work: () => Promise<T>, missingMeansUnserved = true): Promise<T> => {
    const hadSession = session.token() !== undefined;

    try {
      return await work();
    } catch (cause) {
      const error = translateApiError(cause, hadSession);

      if (error.code === "SESSION_EXPIRED") session.expire();
      if (missingMeansUnserved && (error.detail.status === 404 || error.detail.status === 405) && error.code !== "NOT_IMPLEMENTED") {
        throw new DataSourceError("NOT_IMPLEMENTED", "This service is not available on the platform yet.", error.detail);
      }

      throw error;
    }
  };

  const { payments, kyc, limits, security, devices } = rest.account;

  return {
    payments: {
      initiateDeposit: (request, idempotencyKey) => call(() => payments.initiateDeposit(request, { idempotencyKey })),
      verifyDeposit: (reference) => call(() => payments.verifyDeposit(reference), false),
      listHistory: (query) => call(() => payments.listHistory(query)),
      quoteWithdrawal: (request) => call(() => payments.quoteWithdrawal(request)),
      requestWithdrawal: (request, idempotencyKey) => call(() => payments.requestWithdrawal(request, { idempotencyKey })),
      getWithdrawal: (reference) => call(() => payments.getWithdrawal(reference), false),
      listBanks: () => call(() => payments.listBanks()),
      verifyBankAccount: (request) => call(() => payments.verifyBankAccount(request)),
      saveBankAccount: (verificationId, makeDefault) => call(() => payments.saveBankAccount({ verificationId, makeDefault })),
      listBankAccounts: () => call(() => payments.listBankAccounts()),
      setDefaultBankAccount: (id) => call(() => payments.setDefaultBankAccount(id), false),
      deleteBankAccount: (id) => call(() => payments.deleteBankAccount(id), false),
    },
    kyc: {
      getOverview: () => call(() => kyc.getOverview()),
      listDocuments: () => call(() => kyc.listDocuments()),
      uploadDocument: async (input) => {
        const contentType = input.file.type as KycUploadRequest["contentType"];

        if (!(KYC_ACCEPTED_TYPES as readonly string[]).includes(contentType)) {
          throw new DataSourceError("VALIDATION", "Upload a JPEG, PNG or PDF file.", { fields: { file: "Upload a JPEG, PNG or PDF file." } });
        }
        if (input.file.size > KYC_MAX_BYTES || input.file.size === 0) {
          throw new DataSourceError("VALIDATION", "The file must be under 10 MB.", { fields: { file: "The file must be under 10 MB." } });
        }

        const ticket = await call(() => kyc.createUpload({ type: input.type, fileName: input.file.name.slice(0, 200), contentType, sizeBytes: input.file.size }));

        await uploadToTicket(ticket, input.file, {
          allowedHosts: options.uploadHosts,
          ...(input.onProgress === undefined ? {} : { onProgress: input.onProgress }),
          ...(input.signal === undefined ? {} : { signal: input.signal }),
        });

        return call(() => kyc.submitDocument(ticket.uploadId));
      },
      verifyBvn: (request) => call(() => kyc.verifyBvn(request)),
      verifyNin: (request) => call(() => kyc.verifyNin(request)),
    },
    limits: {
      getSummary: () => call(() => limits.getSummary()),
      setLimit: (request) => call(() => limits.setLimit(request)),
      removeLimit: (kind) => call(() => limits.removeLimit(kind)),
      selfExclude: (request) => call(() => limits.selfExclude(request)),
      cancelSelfExclusion: () => call(() => limits.cancelSelfExclusion()),
      listHistory: () => call(() => limits.listHistory()),
    },
    security: {
      changePassword: (request) => call(() => security.changePassword(request)),
      getTwoFactor: () => call(() => security.getTwoFactor()),
      startTwoFactorEnrollment: () => call(() => security.startTwoFactorEnrollment()),
      confirmTwoFactor: (request) => call(() => security.confirmTwoFactor(request)),
      disableTwoFactor: (request) => call(() => security.disableTwoFactor(request)),
      regenerateBackupCodes: (code) => call(() => security.regenerateBackupCodes(code)),
      listSessions: () => call(() => security.listSessions()),
      revokeSession: (id) => call(() => security.revokeSession(id), false),
      revokeOtherSessions: () => call(() => security.revokeOtherSessions()),
      refreshSession: async () => {
        const refreshed = await call(() => security.refreshSession());
        const current = session.snapshot().session;

        if (current !== undefined) session.set({ ...current, expiresAt: refreshed.expiresAt, token: refreshed.token ?? current.token });

        return refreshed;
      },
      getDeletion: () => call(() => security.getDeletion()),
      requestDeletion: (request, idempotencyKey) => call(() => security.requestDeletion(request, { idempotencyKey })),
      cancelDeletion: () => call(() => security.cancelDeletion()),
      createStatement: (request) => call(() => security.createStatement(request)),
      getStatement: (id) => call(() => security.getStatement(id), false),
    },
    devices: {
      getChannelPreferences: () => call(() => devices.getChannelPreferences()),
      setChannelPreferences: (channels) => call(() => devices.setChannelPreferences(channels)),
      listPushDevices: () => call(() => devices.listPushDevices()),
      registerPushDevice: (request) => call(() => devices.registerPushDevice(request)),
      unregisterPushDevice: (id) => call(() => devices.unregisterPushDevice(id), false),
    },
  };
}
