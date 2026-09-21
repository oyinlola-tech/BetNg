import {
  TERMINAL_PAYMENT_STATUSES,
  type AccountDeletion,
  type AccountSession,
  type BackupCodes,
  type BankAccount,
  type ChannelPreferences,
  type KycDocument,
  type KycOverview,
  type LimitHistoryEntry,
  type LimitKind,
  type LimitsSummary,
  type PaymentRecord,
  type PushDevice,
  type ResponsibleGamingLimit,
  type SelfExclusion,
  type StatementJob,
  type TwoFactorStatus,
} from "@betng/contracts";
import { DataSourceError, type AccountServicesSource, type SessionStore } from "@betng/ui-core";
import type { CustomerSession } from "@betng/contracts";
import type { KeyValueStorage } from "../engine.js";
import { uuidFrom } from "../prng.js";

export interface MockWalletHooks {
  readonly available: () => number;
  readonly credit: (amount: number) => void;
  readonly debit: (amount: number) => void;
}

export interface MockAccountOptions {
  readonly session: SessionStore<CustomerSession>;
  readonly wallet: MockWalletHooks;
  readonly storage?: KeyValueStorage;
  readonly latencyMs?: number;
  readonly now?: () => number;
}

/** Accepted by the stand-in for every TOTP prompt; the platform verifies a real time-based code. */
export const MOCK_TOTP_CODE = "246810";

/** A deposit of an amount ending in 13 kobo fails, one ending in 17 kobo expires, so the failure screens can be exercised. */
export const MOCK_FAILING_DEPOSIT_SUFFIX = 13;
export const MOCK_EXPIRING_DEPOSIT_SUFFIX = 17;

const STATE_KEY = "betng.mock.account.v1";

export interface SecondFactorGate {
  readonly required: (userId: string) => boolean;
  readonly verify: (userId: string, code: string) => boolean;
}

const secondFactorGates = new WeakMap<object, SecondFactorGate>();

/** Lets the stand-in sign-in ask the stand-in account services whether a customer has turned on 2FA. */
export function secondFactorGateFor(session: object): SecondFactorGate | undefined {
  return secondFactorGates.get(session);
}

interface AccountState {
  payments: (PaymentRecord & { checks: number })[];
  bankAccounts: { -readonly [K in keyof BankAccount]: BankAccount[K] }[];
  verifications: Record<string, { bankCode: string; bankName: string; accountNumber: string; accountName: string; expiresAt: string }>;
  kyc: { documents: KycDocument[]; bvn: KycOverview["requirements"][number]["status"]; nin: KycOverview["requirements"][number]["status"] };
  limits: ResponsibleGamingLimit[];
  history: LimitHistoryEntry[];
  exclusion: SelfExclusion;
  twoFactor: { enabled: boolean; enabledAt?: string; backupCodes: string[]; pendingEnrollment?: string };
  deletion: AccountDeletion;
  statements: StatementJob[];
  preferences: ChannelPreferences["channels"];
  devices: PushDevice[];
  revokedSessions: string[];
  sequence: number;
}

const BANKS = [
  { code: "044", name: "Access Bank" },
  { code: "058", name: "Guaranty Trust Bank" },
  { code: "011", name: "First Bank of Nigeria" },
  { code: "033", name: "United Bank for Africa" },
  { code: "057", name: "Zenith Bank" },
  { code: "50515", name: "Moniepoint MFB" },
  { code: "999992", name: "OPay" },
] as const;

const TOPICS = { bets: true, payments: true, security: true, kyc: true, limits: true, matches: false, marketing: false };

function initial(): AccountState {
  return {
    payments: [],
    bankAccounts: [],
    verifications: {},
    kyc: { documents: [], bvn: "NOT_STARTED", nin: "NOT_STARTED" },
    limits: [],
    history: [],
    exclusion: { active: false },
    twoFactor: { enabled: false, backupCodes: [] },
    deletion: { status: "NONE", cancellable: false },
    statements: [],
    preferences: { email: { ...TOPICS }, sms: { ...TOPICS, bets: false, kyc: false }, push: { ...TOPICS, matches: true } },
    devices: [],
    revokedSessions: [],
    sequence: 0,
  };
}

const LIMIT_MONEY: readonly LimitKind[] = ["deposit_daily", "deposit_weekly", "deposit_monthly", "loss_daily", "loss_weekly"];
const COOLING_OFF_MS = 24 * 60 * 60 * 1000;
const PERIOD_MS: Record<string, number> = { "24h": 86_400_000, "7d": 7 * 86_400_000, "30d": 30 * 86_400_000, "6m": 182 * 86_400_000 };

/**
 * Development stand-in for the customer account services. Every rule the
 * platform will own (payment state, limits, KYC review, 2FA) is simulated
 * here only so the screens can be exercised without the services.
 */
export function createMockAccountServices(options: MockAccountOptions): AccountServicesSource {
  const now = options.now ?? Date.now;
  const latencyMs = options.latencyMs ?? 350;
  const storage = options.storage;
  const iso = (ms = now()): string => new Date(ms).toISOString();

  const userKey = (): string => {
    const user = options.session.snapshot().session?.user.id;

    if (options.session.snapshot().status !== "AUTHENTICATED" || user === undefined) {
      throw new DataSourceError("SESSION_EXPIRED", "Your session has ended. Sign in again to continue.");
    }

    return user;
  };

  const all: Record<string, AccountState> = (() => {
    try {
      const raw = storage?.get(STATE_KEY);

      return typeof raw === "string" && raw !== "" ? (JSON.parse(raw) as Record<string, AccountState>) : {};
    } catch {
      return {};
    }
  })();

  const state = (): AccountState => {
    const key = userKey();

    all[key] ??= initial();

    return all[key];
  };

  const save = (): void => {
    storage?.set(STATE_KEY, JSON.stringify(all));
  };

  async function call<T>(work: (s: AccountState) => T): Promise<T> {
    await new Promise((resolve) => setTimeout(resolve, latencyMs));

    const s = state();
    const result = work(s);

    save();

    return result;
  }

  const nextId = (s: AccountState, prefix: string): string => {
    s.sequence += 1;

    return `${prefix}${String(now()).slice(-6)}${String(s.sequence).padStart(3, "0")}`;
  };

  const restricted = (s: AccountState): boolean => s.exclusion.active && (s.exclusion.endsAt === undefined || Date.parse(s.exclusion.endsAt) > now());

  const summary = (s: AccountState): LimitsSummary => {
    for (const limit of s.limits) {
      if (limit.pendingValue !== undefined && limit.pendingEffectiveAt !== undefined && Date.parse(limit.pendingEffectiveAt) <= now()) {
        Object.assign(limit, { value: limit.pendingValue, status: "active", effectiveAt: limit.pendingEffectiveAt });
        delete (limit as { pendingValue?: number }).pendingValue;
        delete (limit as { pendingEffectiveAt?: string }).pendingEffectiveAt;
      }
    }

    if (s.exclusion.active && s.exclusion.endsAt !== undefined && Date.parse(s.exclusion.endsAt) <= now()) s.exclusion = { active: false };

    return { limits: s.limits.map((l) => ({ ...l })), selfExclusion: { ...s.exclusion }, restricted: restricted(s) };
  };

  const depositUsed = (s: AccountState, windowMs: number): number =>
    s.payments.filter((p) => p.direction === "DEPOSIT" && p.status !== "FAILED" && p.status !== "EXPIRED" && Date.parse(p.createdAt) > now() - windowMs).reduce((sum, p) => sum + p.amount, 0);

  const advance = (payment: PaymentRecord & { checks: number }): void => {
    if (TERMINAL_PAYMENT_STATUSES.includes(payment.status)) return;

    payment.checks += 1;
    const suffix = payment.amount % 100;
    const at = iso();

    if (payment.direction === "DEPOSIT") {
      if (payment.checks === 1) Object.assign(payment, { status: "PROCESSING", updatedAt: at });
      else if (suffix === MOCK_FAILING_DEPOSIT_SUFFIX) Object.assign(payment, { status: "FAILED", failureReason: "The card issuer declined the charge.", updatedAt: at, completedAt: at });
      else if (suffix === MOCK_EXPIRING_DEPOSIT_SUFFIX) Object.assign(payment, { status: "EXPIRED", failureReason: "The payment window closed before it was completed.", updatedAt: at, completedAt: at });
      else {
        Object.assign(payment, { status: "CONFIRMED", updatedAt: at, completedAt: at });
        options.wallet.credit(payment.amount);
      }
    } else if (payment.checks >= 2) {
      Object.assign(payment, { status: "CONFIRMED", updatedAt: at, completedAt: at });
    } else {
      Object.assign(payment, { status: "PROCESSING", updatedAt: at });
    }
  };

  const findPayment = (s: AccountState, reference: string): PaymentRecord & { checks: number } => {
    const payment = s.payments.find((p) => p.reference === reference);

    if (payment === undefined) throw new DataSourceError("NOT_FOUND", "There is no payment with that reference.");

    return payment;
  };

  const publicPayment = ({ checks: _checks, ...payment }: PaymentRecord & { checks: number }): PaymentRecord => payment;

  const idempotent = new Map<string, unknown>();
  const once = <T>(key: string, work: () => T): T => {
    if (idempotent.has(key)) return idempotent.get(key) as T;

    const result = work();

    idempotent.set(key, result);

    return result;
  };

  const requireTotp = (s: AccountState, code: string): void => {
    if (code === MOCK_TOTP_CODE) return;

    const normalised = code.replace("-", "").toUpperCase();
    const index = s.twoFactor.backupCodes.findIndex((c) => c.replace("-", "") === normalised);

    if (index < 0) throw new DataSourceError("VALIDATION", "That code is not right.", { fields: { code: "That code is not right." } });

    s.twoFactor.backupCodes.splice(index, 1);
  };

  const newBackupCodes = (s: AccountState): BackupCodes => {
    const codes = Array.from({ length: 10 }, (_, i) => {
      const raw = uuidFrom(`${String(now())}:${String(i)}:${String(s.sequence)}`).replace(/-/g, "").toUpperCase();

      return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
    });

    s.twoFactor.backupCodes = codes;

    return { codes, generatedAt: iso() };
  };

  const kycOverview = (s: AccountState): KycOverview => {
    const docStatus: KycOverview["status"] = s.kyc.documents.some((d) => d.status === "VERIFIED")
      ? "VERIFIED"
      : s.kyc.documents.some((d) => d.status === "PENDING")
        ? "PENDING"
        : s.kyc.documents.some((d) => d.status === "REJECTED")
          ? "REQUIRES_ACTION"
          : "NOT_STARTED";
    const checks = [
      { check: "BVN" as const, status: s.kyc.bvn },
      { check: "NIN" as const, status: s.kyc.nin },
      { check: "DOCUMENT" as const, status: docStatus },
    ];
    const verified = checks.filter((c) => c.status === "VERIFIED").length;
    const status = verified === checks.length ? "VERIFIED" : checks.some((c) => c.status === "PENDING") ? "PENDING" : checks.some((c) => c.status === "REQUIRES_ACTION") ? "REQUIRES_ACTION" : verified > 0 ? "PENDING" : "NOT_STARTED";

    return {
      status,
      tier: verified === 3 ? "TIER_3" : verified === 2 ? "TIER_2" : verified === 1 ? "TIER_1" : "TIER_0",
      requirements: checks,
      limits: { dailyDeposit: [5_000_000, 20_000_000, 100_000_000, 500_000_000][verified], dailyWithdrawal: [0, 10_000_000, 50_000_000, 250_000_000][verified] },
    };
  };

  const settleReviews = (s: AccountState): void => {
    for (const doc of s.kyc.documents) {
      if (doc.status === "PENDING" && Date.parse(doc.uploadedAt) < now() - 20_000) {
        Object.assign(doc, doc.fileName.toLowerCase().includes("blurry")
          ? { status: "REJECTED", reviewedAt: iso(), rejectionReason: "The document is not readable. Upload a clearer photo." }
          : { status: "VERIFIED", reviewedAt: iso() });
      }
    }
  };

  const currentSessionId = (): string => uuidFrom(`session:${options.session.token() ?? ""}`);

  secondFactorGates.set(options.session, {
    required: (userId) => all[userId]?.twoFactor.enabled === true,
    verify: (userId, code) => {
      const s = all[userId];

      if (s === undefined) return false;

      try {
        requireTotp(s, code);
        save();

        return true;
      } catch {
        return false;
      }
    },
  });

  return {
    payments: {
      /** @endpoint POST /api/v1/payments/deposit/initiate { amount, method, returnPath? } (Idempotency-Key) → DepositInitiation */
      initiateDeposit: (request, key) =>
        call((s) =>
          once(`deposit:${key}`, () => {
            if (restricted(s)) throw new DataSourceError("SELF_EXCLUDED", "Deposits are paused while your self-exclusion is active.");

            for (const [kind, windowMs] of [["deposit_daily", 86_400_000], ["deposit_weekly", 7 * 86_400_000], ["deposit_monthly", 30 * 86_400_000]] as const) {
              const limit = s.limits.find((l) => l.kind === kind);

              if (limit !== undefined && depositUsed(s, windowMs) + request.amount > limit.value) {
                throw new DataSourceError("LIMIT_EXCEEDED", "This deposit would go over your deposit limit.");
              }
            }

            const at = iso();
            const payment = {
              reference: nextId(s, "DEP"),
              direction: "DEPOSIT" as const,
              status: "PENDING" as const,
              amount: request.amount,
              currency: "NGN" as const,
              method: request.method,
              provider: "PAYSTACK" as const,
              createdAt: at,
              updatedAt: at,
              checks: 0,
            };

            s.payments.unshift(payment);

            return {
              payment: publicPayment(payment),
              instructions: {
                title: "Development stand-in",
                lines: ["No provider is contacted in development.", "The payment moves to processing, then settles when its status is checked again."],
              },
              expiresAt: iso(now() + 30 * 60_000),
            };
          }),
        ),

      /** @endpoint POST /api/v1/payments/deposit/verify { reference } → PaymentRecord (asks the provider, never trusts the redirect) */
      verifyDeposit: (reference) =>
        call((s) => {
          const payment = findPayment(s, reference);

          advance(payment);

          return publicPayment(payment);
        }),

      /** @endpoint GET /api/v1/payments/history?page&pageSize&direction&status → Page<PaymentRecord> */
      listHistory: (query = {}) =>
        call((s) => {
          const rows = s.payments.filter((p) => (query.direction === undefined || p.direction === query.direction) && (query.status === undefined || p.status === query.status));
          const page = query.page ?? 1;
          const pageSize = query.pageSize ?? 20;

          return { items: rows.slice((page - 1) * pageSize, page * pageSize).map(publicPayment), page, pageSize, total: rows.length };
        }),

      /** @endpoint POST /api/v1/payments/withdraw/quote { amount, bankAccountId } → WithdrawalQuote */
      quoteWithdrawal: (request) =>
        call(() => {
          const fee = request.amount >= 5_000_000 ? 5_000 : 2_500;

          if (request.amount <= fee) throw new DataSourceError("VALIDATION", "The amount must be more than the transfer fee.");

          return { amount: request.amount, fee, netAmount: request.amount - fee, currency: "NGN" as const, expiresAt: iso(now() + 5 * 60_000) };
        }),

      /** @endpoint POST /api/v1/payments/withdraw/request { amount, bankAccountId } (Idempotency-Key) → PaymentRecord */
      requestWithdrawal: (request, key) =>
        call((s) =>
          once(`withdraw:${key}`, () => {
            if (!s.bankAccounts.some((a) => a.id === request.bankAccountId)) throw new DataSourceError("NOT_FOUND", "That bank account is not on your profile.");
            if (request.amount > options.wallet.available()) throw new DataSourceError("INSUFFICIENT_FUNDS", "Your available balance does not cover this withdrawal.");

            options.wallet.debit(request.amount);

            const fee = request.amount >= 5_000_000 ? 5_000 : 2_500;
            const at = iso();
            const payment = {
              reference: nextId(s, "WDR"),
              direction: "WITHDRAWAL" as const,
              status: "PENDING" as const,
              amount: request.amount,
              fee,
              netAmount: request.amount - fee,
              currency: "NGN" as const,
              bankAccountId: request.bankAccountId,
              provider: "PAYSTACK" as const,
              createdAt: at,
              updatedAt: at,
              checks: 0,
            };

            s.payments.unshift(payment);

            return publicPayment(payment);
          }),
        ),

      /** @endpoint GET /api/v1/payments/withdraw/status/:reference → PaymentRecord */
      getWithdrawal: (reference) =>
        call((s) => {
          const payment = findPayment(s, reference);

          advance(payment);

          return publicPayment(payment);
        }),

      /** @endpoint GET /api/v1/payments/banks → { items: Bank[] } */
      listBanks: () => call(() => BANKS.map((b) => ({ ...b }))),

      /** @endpoint POST /api/v1/payments/bank-accounts/verify { bankCode, accountNumber } → BankAccountVerification (name enquiry) */
      verifyBankAccount: (request) =>
        call((s) => {
          const bank = BANKS.find((b) => b.code === request.bankCode);

          if (bank === undefined) throw new DataSourceError("VALIDATION", "Choose a bank from the list.");
          if (request.accountNumber.startsWith("000")) throw new DataSourceError("NOT_FOUND", "No account matches that number at this bank.");

          const user = options.session.snapshot().session?.user.displayName ?? "Account Holder";
          const verificationId = nextId(s, "NEQ");
          const verification = { bankCode: bank.code, bankName: bank.name, accountNumber: request.accountNumber, accountName: user.toUpperCase(), expiresAt: iso(now() + 10 * 60_000) };

          s.verifications[verificationId] = verification;

          return { verificationId, bankCode: bank.code, accountName: verification.accountName, accountNumberMasked: `******${request.accountNumber.slice(-4)}`, expiresAt: verification.expiresAt };
        }),

      /** @endpoint POST /api/v1/payments/bank-accounts { verificationId, makeDefault } → BankAccount */
      saveBankAccount: (verificationId, makeDefault) =>
        call((s) => {
          const verification = s.verifications[verificationId];

          if (verification === undefined || Date.parse(verification.expiresAt) < now()) throw new DataSourceError("CONFLICT", "The account check expired. Verify the account again.");

          delete s.verifications[verificationId];

          const isDefault = makeDefault || s.bankAccounts.length === 0;

          if (isDefault) for (const account of s.bankAccounts) account.isDefault = false;

          const account: BankAccount = {
            id: nextId(s, "BA"),
            bankCode: verification.bankCode,
            bankName: verification.bankName,
            accountNumberMasked: `******${verification.accountNumber.slice(-4)}`,
            accountName: verification.accountName,
            isDefault,
            verified: true,
            createdAt: iso(),
          };

          s.bankAccounts.push(account);

          return { ...account };
        }),

      /** @endpoint GET /api/v1/payments/bank-accounts → { items: BankAccount[] } */
      listBankAccounts: () => call((s) => s.bankAccounts.map((a) => ({ ...a }))),

      /** @endpoint POST /api/v1/payments/bank-accounts/:id/default → BankAccount */
      setDefaultBankAccount: (id) =>
        call((s) => {
          const target = s.bankAccounts.find((a) => a.id === id);

          if (target === undefined) throw new DataSourceError("NOT_FOUND", "That bank account is not on your profile.");
          for (const account of s.bankAccounts) account.isDefault = account.id === id;

          return { ...target };
        }),

      /** @endpoint DELETE /api/v1/payments/bank-accounts/:id → 204 */
      deleteBankAccount: (id) =>
        call((s) => {
          if (s.payments.some((p) => p.bankAccountId === id && !TERMINAL_PAYMENT_STATUSES.includes(p.status))) {
            throw new DataSourceError("CONFLICT", "A withdrawal to this account is still processing.");
          }

          const wasDefault = s.bankAccounts.find((a) => a.id === id)?.isDefault === true;

          s.bankAccounts = s.bankAccounts.filter((a) => a.id !== id);
          if (wasDefault && s.bankAccounts[0] !== undefined) s.bankAccounts[0].isDefault = true;
        }),
    },

    kyc: {
      /** @endpoint GET /api/v1/kyc/status → KycOverview */
      getOverview: () =>
        call((s) => {
          settleReviews(s);

          return kycOverview(s);
        }),

      /** @endpoint GET /api/v1/kyc/documents → { items: KycDocument[] } */
      listDocuments: () =>
        call((s) => {
          settleReviews(s);

          return s.kyc.documents.map((d) => ({ ...d }));
        }),

      /**
       * @endpoint POST /api/v1/kyc/documents/uploads { type, fileName, contentType, sizeBytes } → KycUploadTicket
       * @endpoint PUT <uploadUrl> (the file, to platform-issued storage)
       * @endpoint POST /api/v1/kyc/documents { uploadId } → KycDocument
       */
      uploadDocument: async (input) => {
        if (!["image/jpeg", "image/png", "application/pdf"].includes(input.file.type)) {
          throw new DataSourceError("VALIDATION", "Upload a JPEG, PNG or PDF file.", { fields: { file: "Upload a JPEG, PNG or PDF file." } });
        }
        if (input.file.size === 0 || input.file.size > 10 * 1024 * 1024) {
          throw new DataSourceError("VALIDATION", "The file must be under 10 MB.", { fields: { file: "The file must be under 10 MB." } });
        }

        for (let step = 1; step <= 5; step += 1) {
          if (input.signal?.aborted === true) throw new DataSourceError("CONFLICT", "The upload was cancelled.");
          await new Promise((resolve) => setTimeout(resolve, latencyMs / 2));
          input.onProgress?.({ loaded: Math.round((input.file.size * step) / 5), total: input.file.size });
        }

        return call((s) => {
          const doc: KycDocument = { id: nextId(s, "DOC"), type: input.type, status: "PENDING", fileName: input.file.name.slice(0, 200), sizeBytes: input.file.size, uploadedAt: iso() };

          s.kyc.documents.unshift(doc);

          return { ...doc };
        });
      },

      /** @endpoint POST /api/v1/kyc/verify/bvn { bvn, dateOfBirth } → IdentityCheckResult */
      verifyBvn: (request) =>
        call((s) => {
          s.kyc.bvn = request.bvn.startsWith("0") ? "REJECTED" : "VERIFIED";

          return { check: "BVN" as const, status: s.kyc.bvn, ...(s.kyc.bvn === "REJECTED" ? { message: "The details did not match the BVN record." } : {}) };
        }),

      /** @endpoint POST /api/v1/kyc/verify/nin { nin, dateOfBirth } → IdentityCheckResult */
      verifyNin: (request) =>
        call((s) => {
          s.kyc.nin = request.nin.startsWith("0") ? "REJECTED" : "VERIFIED";

          return { check: "NIN" as const, status: s.kyc.nin, ...(s.kyc.nin === "REJECTED" ? { message: "The details did not match the NIN record." } : {}) };
        }),
    },

    limits: {
      /** @endpoint GET /api/v1/limits/summary → LimitsSummary */
      getSummary: () => call(summary),

      /** @endpoint PUT /api/v1/limits { kind, value } → LimitsSummary (tightening applies now; loosening waits 24h) */
      setLimit: (request) =>
        call((s) => {
          if (LIMIT_MONEY.includes(request.kind) && request.value < 100) throw new DataSourceError("VALIDATION", "Set a limit of at least ₦1.");
          if (request.kind === "session_minutes" && (request.value < 15 || request.value > 1440)) throw new DataSourceError("VALIDATION", "Choose between 15 minutes and 24 hours.");

          const existing = s.limits.find((l) => l.kind === request.kind);
          const at = iso();

          if (existing === undefined) {
            s.limits.push({ kind: request.kind, status: "active", value: request.value, effectiveAt: at });
            s.history.unshift({ id: nextId(s, "LH"), kind: request.kind, action: "SET", value: request.value, at });
          } else if (request.value <= existing.value) {
            s.history.unshift({ id: nextId(s, "LH"), kind: request.kind, action: "LOWERED", previousValue: existing.value, value: request.value, at });
            Object.assign(existing, { value: request.value, status: "active", effectiveAt: at });
            delete (existing as { pendingValue?: number }).pendingValue;
            delete (existing as { pendingEffectiveAt?: string }).pendingEffectiveAt;
          } else {
            Object.assign(existing, { status: "pending", pendingValue: request.value, pendingEffectiveAt: iso(now() + COOLING_OFF_MS) });
            s.history.unshift({ id: nextId(s, "LH"), kind: request.kind, action: "RAISED", previousValue: existing.value, value: request.value, at });
          }

          return summary(s);
        }),

      /** @endpoint DELETE /api/v1/limits/:kind → LimitsSummary (removal waits out the cooling-off period) */
      removeLimit: (kind) =>
        call((s) => {
          const existing = s.limits.find((l) => l.kind === kind);

          if (existing === undefined) throw new DataSourceError("NOT_FOUND", "There is no such limit on your account.");

          Object.assign(existing, { status: "requested", pendingEffectiveAt: iso(now() + COOLING_OFF_MS) });
          s.history.unshift({ id: nextId(s, "LH"), kind, action: "REMOVED", previousValue: existing.value, at: iso() });

          return summary(s);
        }),

      /** @endpoint POST /api/v1/limits/self-exclude { period, password } → SelfExclusion */
      selfExclude: (request) =>
        call((s) => {
          if (request.password.length < 8) throw new DataSourceError("VALIDATION", "That password is not right.", { fields: { password: "That password is not right." } });

          const start = now();
          const length = PERIOD_MS[request.period];

          s.exclusion = {
            active: true,
            period: request.period,
            startedAt: iso(start),
            ...(length === undefined ? {} : { endsAt: iso(start + length), canCancelAt: iso(start + length) }),
          };
          s.history.unshift({ id: nextId(s, "LH"), kind: "self_exclude", action: "EXCLUDED", at: iso(start) });

          return { ...s.exclusion };
        }),

      /** @endpoint DELETE /api/v1/limits/self-exclude → SelfExclusion (refused before canCancelAt) */
      cancelSelfExclusion: () =>
        call((s) => {
          if (s.exclusion.canCancelAt === undefined || Date.parse(s.exclusion.canCancelAt) > now()) {
            throw new DataSourceError("CONFLICT", "A self-exclusion cannot be cancelled before it ends.");
          }

          s.exclusion = { active: false };

          return { ...s.exclusion };
        }),

      /** @endpoint GET /api/v1/limits/history → { items: LimitHistoryEntry[] } */
      listHistory: () => call((s) => s.history.map((h) => ({ ...h }))),
    },

    security: {
      /** @endpoint PUT /api/v1/account/password { currentPassword, newPassword } → 204 (revokes other sessions) */
      changePassword: (request) =>
        call(() => {
          if (request.currentPassword === request.newPassword) throw new DataSourceError("VALIDATION", "Choose a password you have not used here.", { fields: { newPassword: "Choose a password you have not used here." } });
          if (request.newPassword.toLowerCase().includes("password")) throw new DataSourceError("VALIDATION", "That password appears in known breaches. Choose another.", { fields: { newPassword: "That password appears in known breaches. Choose another." } });
        }),

      /** @endpoint GET /api/v1/account/2fa → TwoFactorStatus */
      getTwoFactor: () =>
        call((s): TwoFactorStatus => ({
          enabled: s.twoFactor.enabled,
          required: false,
          ...(s.twoFactor.enabled ? { method: "TOTP" as const, backupCodesRemaining: s.twoFactor.backupCodes.length } : {}),
          ...(s.twoFactor.enabledAt === undefined ? {} : { enabledAt: s.twoFactor.enabledAt }),
        })),

      /** @endpoint POST /api/v1/account/2fa/enroll → TwoFactorEnrollment (secret generated and stored by the platform) */
      startTwoFactorEnrollment: () =>
        call((s) => {
          if (s.twoFactor.enabled) throw new DataSourceError("CONFLICT", "Two-step verification is already on.");

          const enrollmentId = nextId(s, "ENR");
          const email = options.session.snapshot().session?.user.email ?? "customer";

          s.twoFactor.pendingEnrollment = enrollmentId;

          return {
            enrollmentId,
            otpauthUri: `otpauth://totp/BETNG:${encodeURIComponent(email)}?secret=JBSWY3DPEHPK3PXP&issuer=BETNG&digits=6&period=30`,
            manualKey: "JBSW Y3DP EHPK 3PXP",
            expiresAt: iso(now() + 10 * 60_000),
          };
        }),

      /** @endpoint POST /api/v1/account/2fa/confirm { enrollmentId, code } → BackupCodes */
      confirmTwoFactor: (request) =>
        call((s) => {
          if (s.twoFactor.pendingEnrollment !== request.enrollmentId) throw new DataSourceError("CONFLICT", "Start the setup again.");
          if (request.code !== MOCK_TOTP_CODE) throw new DataSourceError("VALIDATION", "That code is not right.", { fields: { code: "That code is not right." } });

          delete s.twoFactor.pendingEnrollment;
          s.twoFactor.enabled = true;
          s.twoFactor.enabledAt = iso();

          return newBackupCodes(s);
        }),

      /** @endpoint POST /api/v1/account/2fa/disable { password, code } → TwoFactorStatus */
      disableTwoFactor: (request) =>
        call((s) => {
          if (request.password.length < 8) throw new DataSourceError("VALIDATION", "That password is not right.", { fields: { password: "That password is not right." } });
          requireTotp(s, request.code);
          s.twoFactor = { enabled: false, backupCodes: [] };

          return { enabled: false, required: false };
        }),

      /** @endpoint POST /api/v1/account/2fa/backup-codes { code } → BackupCodes (replaces the old set) */
      regenerateBackupCodes: (code) =>
        call((s) => {
          if (!s.twoFactor.enabled) throw new DataSourceError("CONFLICT", "Turn on two-step verification first.");
          requireTotp(s, code);

          return newBackupCodes(s);
        }),

      /** @endpoint GET /api/v1/account/sessions → { items: AccountSession[] } */
      listSessions: () =>
        call((s): AccountSession[] => {
          const current = options.session.snapshot().session;
          const others: AccountSession[] = [
            { id: "mock-session-android", current: false, device: "Pixel 8", platform: "Android", browser: "BETNG app", location: "Lagos, NG", createdAt: iso(now() - 5 * 86_400_000), lastActiveAt: iso(now() - 3 * 3_600_000), expiresAt: iso(now() + 2 * 86_400_000) },
            { id: "mock-session-desktop", current: false, device: "Desktop", platform: "Windows", browser: "Edge", location: "Abuja, NG", createdAt: iso(now() - 9 * 86_400_000), lastActiveAt: iso(now() - 26 * 3_600_000), expiresAt: iso(now() + 86_400_000) },
          ].filter((row) => !s.revokedSessions.includes(row.id));

          return [
            { id: currentSessionId(), current: true, device: "This device", platform: "Web", browser: "Browser", createdAt: current?.user.lastActiveAt ?? iso(), lastActiveAt: iso(), expiresAt: current?.expiresAt ?? iso() },
            ...others,
          ];
        }),

      /** @endpoint DELETE /api/v1/account/sessions/:id → 204 */
      revokeSession: (id) =>
        call((s) => {
          if (id === currentSessionId()) throw new DataSourceError("CONFLICT", "Use sign out to end this session.");
          s.revokedSessions.push(id);
        }),

      /** @endpoint DELETE /api/v1/account/sessions → 204 (every session except this one) */
      revokeOtherSessions: () =>
        call((s) => {
          s.revokedSessions.push("mock-session-android", "mock-session-desktop");
        }),

      /** @endpoint POST /api/v1/auth/session/refresh → SessionRefresh */
      refreshSession: async () => {
        const result = await call(() => ({ expiresAt: iso(now() + 30 * 60_000) }));
        const current = options.session.snapshot().session;

        if (current !== undefined) options.session.set({ ...current, expiresAt: result.expiresAt });

        return result;
      },

      /** @endpoint GET /api/v1/account/deletion → AccountDeletion */
      getDeletion: () => call((s) => ({ ...s.deletion })),

      /** @endpoint POST /api/v1/account/deletion { password, reason? } (Idempotency-Key) → AccountDeletion */
      requestDeletion: (request, key) =>
        call((s) =>
          once(`deletion:${key}`, () => {
            if (request.password.length < 8) throw new DataSourceError("VALIDATION", "That password is not right.", { fields: { password: "That password is not right." } });

            const blockers = s.payments.some((p) => !TERMINAL_PAYMENT_STATUSES.includes(p.status)) ? ["A payment is still processing."] : [];

            s.deletion = { status: "PENDING", requestedAt: iso(), scheduledFor: iso(now() + 14 * 86_400_000), cancellable: true, ...(blockers.length === 0 ? {} : { blockers }) };

            return { ...s.deletion };
          }),
        ),

      /** @endpoint DELETE /api/v1/account/deletion → AccountDeletion */
      cancelDeletion: () =>
        call((s) => {
          if (!s.deletion.cancellable) throw new DataSourceError("CONFLICT", "There is no deletion request to cancel.");
          s.deletion = { status: "CANCELLED", cancellable: false };

          return { ...s.deletion };
        }),

      /** @endpoint POST /api/v1/account/statements { format, from, to, types? } → StatementJob (generated by the platform) */
      createStatement: (request) =>
        call((s) => {
          if (request.from > request.to) throw new DataSourceError("VALIDATION", "The start date must be before the end date.");

          const job: StatementJob = { id: nextId(s, "STM"), status: "QUEUED", format: request.format, from: request.from, to: request.to, createdAt: iso() };

          s.statements.unshift(job);

          return { ...job };
        }),

      /** @endpoint GET /api/v1/account/statements/:id → StatementJob (downloadUrl is a short-lived signed URL) */
      getStatement: (id) =>
        call((s) => {
          const job = s.statements.find((j) => j.id === id);

          if (job === undefined) throw new DataSourceError("NOT_FOUND", "That statement is not available.");

          return job.status === "QUEUED" && Date.parse(job.createdAt) < now() - 2_000
            ? { ...job, status: "FAILED" as const }
            : { ...job };
        }),
    },

    devices: {
      /** @endpoint GET /api/v1/notifications/preferences → ChannelPreferences */
      getChannelPreferences: () => call((s) => ({ channels: structuredClone(s.preferences), locked: ["email.security"] })),

      /** @endpoint PUT /api/v1/notifications/preferences { channels } → ChannelPreferences */
      setChannelPreferences: (channels) =>
        call((s) => {
          s.preferences = { ...structuredClone(channels), email: { ...channels.email, security: true } };

          return { channels: structuredClone(s.preferences), locked: ["email.security"] };
        }),

      /** @endpoint GET /api/v1/notifications/push/devices → { items: PushDevice[] } */
      listPushDevices: () => call((s) => s.devices.map((d) => ({ ...d }))),

      /** @endpoint POST /api/v1/notifications/push/register { platform, token, label } → PushDevice */
      registerPushDevice: (request) =>
        call((s) => {
          const device: PushDevice = { id: nextId(s, "DEV"), platform: request.platform, label: request.label, current: true, registeredAt: iso() };

          s.devices = [...s.devices.map((d) => ({ ...d, current: false })), device];

          return { ...device };
        }),

      /** @endpoint DELETE /api/v1/notifications/push/devices/:id → 204 */
      unregisterPushDevice: (id) =>
        call((s) => {
          s.devices = s.devices.filter((d) => d.id !== id);
        }),
    },
  };
}
