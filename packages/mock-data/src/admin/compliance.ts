import type { AdminPayment, AdminSession, KycReviewItem, ResponsibleGamingAccount } from "@betng/contracts";
import { DataSourceError, type ComplianceDataSource, type SessionStore } from "@betng/ui-core";
import { rng, uuidFrom } from "../prng.js";

export interface MockComplianceOptions {
  readonly session: SessionStore<AdminSession>;
  readonly latencyMs?: number;
  readonly now?: () => number;
}

const NAMES = ["Adaeze Nwosu", "Tunde Bakare", "Halima Sule", "Emeka Obi", "Kemi Adeyemi", "Ibrahim Musa", "Ngozi Eze", "Segun Alabi", "Zainab Bello", "Chinedu Okeke", "Funmi Ojo", "Yusuf Garba"];

function page<T>(rows: readonly T[], p = 1, size = 20): { items: T[]; page: number; pageSize: number; total: number } {
  return { items: rows.slice((p - 1) * size, p * size), page: p, pageSize: size, total: rows.length };
}

/** Development stand-in for the operator compliance views. The rows are generated fixtures, never presented outside development. */
export function createMockComplianceSource(options: MockComplianceOptions): ComplianceDataSource {
  const now = options.now ?? Date.now;
  const latencyMs = options.latencyMs ?? 300;
  const iso = (ms: number): string => new Date(ms).toISOString();
  const r = rng("compliance");
  const email = (name: string): string => `${name.toLowerCase().replace(" ", ".")}@example.test`;

  const kyc: KycReviewItem[] = NAMES.slice(0, 8).map((name, i) => {
    const userId = uuidFrom(`kyc:${name}`);
    const submittedAt = iso(now() - (i + 1) * 3_600_000 * (1 + r.next()));

    return {
      userId,
      displayName: name,
      email: email(name),
      status: i < 5 ? "PENDING" : i === 5 ? "REQUIRES_ACTION" : "VERIFIED",
      tier: i < 5 ? "TIER_1" : "TIER_2",
      submittedAt,
      documents: [
        { id: uuidFrom(`doc:${name}:id`), type: i % 2 === 0 ? "NATIONAL_ID" : "PASSPORT", status: i < 5 ? "PENDING" : "VERIFIED", fileName: "id-front.jpg", sizeBytes: 1_200_000 + i * 40_000, uploadedAt: submittedAt },
        ...(i % 3 === 0 ? [{ id: uuidFrom(`doc:${name}:addr`), type: "PROOF_OF_ADDRESS" as const, status: "PENDING" as const, fileName: "utility-bill.pdf", sizeBytes: 340_000, uploadedAt: submittedAt }] : []),
      ],
    };
  });

  const statuses = ["CONFIRMED", "CONFIRMED", "CONFIRMED", "PENDING", "PROCESSING", "FAILED"] as const;
  const payments: AdminPayment[] = Array.from({ length: 48 }, (_, i) => {
    const name = NAMES[i % NAMES.length] as string;
    const direction = i % 4 === 0 ? ("WITHDRAWAL" as const) : ("DEPOSIT" as const);
    const status = statuses[i % statuses.length] as AdminPayment["status"];
    const created = now() - i * 47 * 60_000;
    const amount = (Math.round(r.next() * 400) + 10) * 10_000;

    return {
      reference: `${direction === "DEPOSIT" ? "DEP" : "WDR"}${String(900_000 + i)}`,
      direction,
      status,
      amount,
      ...(direction === "WITHDRAWAL" ? { fee: 2_500, netAmount: amount - 2_500 } : {}),
      currency: "NGN" as const,
      method: direction === "DEPOSIT" ? (i % 3 === 0 ? ("BANK_TRANSFER" as const) : ("CARD" as const)) : undefined,
      provider: i % 5 === 0 ? ("FLUTTERWAVE" as const) : ("PAYSTACK" as const),
      ...(status === "FAILED" ? { failureReason: "Declined by issuer." } : {}),
      createdAt: iso(created),
      updatedAt: iso(created + 60_000),
      ...(status === "CONFIRMED" || status === "FAILED" ? { completedAt: iso(created + 60_000) } : {}),
      userId: uuidFrom(`user:${name}`),
      userEmail: email(name),
      providerReference: `mock_${String(i).padStart(6, "0")}`,
    };
  });

  const responsible: ResponsibleGamingAccount[] = NAMES.slice(4, 10).map((name, i) => ({
    userId: uuidFrom(`user:${name}`),
    displayName: name,
    email: email(name),
    limits: [{ kind: "deposit_daily" as const, status: "active" as const, value: 5_000_000, used: 1_000_000 * (i + 1), effectiveAt: iso(now() - 86_400_000 * (i + 2)) }],
    selfExclusion: i === 0 ? { active: true, period: "30d" as const, startedAt: iso(now() - 3 * 86_400_000), endsAt: iso(now() + 27 * 86_400_000) } : { active: false },
    restricted: i === 0,
    flaggedAt: iso(now() - i * 5_400_000),
    flags: i === 0 ? ["SELF_EXCLUDED" as const] : i % 2 === 0 ? ["LIMIT_BREACH_ATTEMPT" as const] : ["LIMIT_RAISED" as const, "LONG_SESSION" as const],
  }));

  async function call<T>(permission: string, work: () => T): Promise<T> {
    await new Promise((resolve) => setTimeout(resolve, latencyMs));

    const active = options.session.snapshot();

    if (active.status !== "AUTHENTICATED") throw new DataSourceError("SESSION_EXPIRED", "Your session has ended. Sign in again to continue.");
    if (!(active.session?.admin.permissions ?? []).includes(permission) && active.session?.admin.role !== "SUPER_ADMIN") {
      throw new DataSourceError("FORBIDDEN", `Your role does not include “${permission}”.`);
    }

    return work();
  }

  const match = (text: string, search?: string): boolean => search === undefined || search === "" || text.toLowerCase().includes(search.toLowerCase());

  return {
    /** @endpoint GET /api/v1/admin/kyc/pending?page&pageSize&search&status → Page<KycReviewItem> (kyc:read) */
    listKycQueue: (query = {}) =>
      call("kyc:read", () => page(kyc.filter((k) => (query.status === undefined || k.status === query.status) && match(`${k.displayName} ${k.email}`, query.search)), query.page, query.pageSize)),

    /** @endpoint POST /api/v1/admin/kyc/review/:userId { decision, reason } → KycReviewItem (kyc:write, audit-logged) */
    reviewKyc: (userId, decision) =>
      call("kyc:write", () => {
        const item = kyc.find((k) => k.userId === userId);

        if (item === undefined) throw new DataSourceError("NOT_FOUND", "That customer is not in the queue.");

        const status = decision.decision === "APPROVE" ? ("VERIFIED" as const) : decision.decision === "REJECT" ? ("REJECTED" as const) : ("REQUIRES_ACTION" as const);

        Object.assign(item, { status, documents: item.documents.map((d) => ({ ...d, status, reviewedAt: iso(now()), ...(status === "VERIFIED" ? {} : { rejectionReason: decision.reason }) })) });

        return { ...item };
      }),

    /** @endpoint GET /api/v1/admin/kyc/documents/:id/preview → KycDocumentPreview (short-lived signed URL; kyc:read) */
    previewKycDocument: () => call("kyc:read", () => {
      throw new DataSourceError("NOT_IMPLEMENTED", "Document previews are served by the platform's document store; the development stand-in holds no files.");
    }),

    /** @endpoint GET /api/v1/admin/payments/overview → PaymentOverview (payments:read) */
    getPaymentOverview: () =>
      call("payments:read", () => {
        const today = payments.filter((p) => Date.parse(p.createdAt) > now() - 86_400_000);
        const total = (direction: AdminPayment["direction"]): number => today.filter((p) => p.direction === direction && p.status === "CONFIRMED").reduce((sum, p) => sum + p.amount, 0);

        return {
          depositsToday: total("DEPOSIT"),
          withdrawalsToday: total("WITHDRAWAL"),
          pendingDeposits: payments.filter((p) => p.direction === "DEPOSIT" && (p.status === "PENDING" || p.status === "PROCESSING")).length,
          pendingWithdrawals: payments.filter((p) => p.direction === "WITHDRAWAL" && (p.status === "PENDING" || p.status === "PROCESSING")).length,
          failedToday: today.filter((p) => p.status === "FAILED").length,
          providers: [
            { provider: "PAYSTACK", status: "UP" as const, checkedAt: iso(now() - 30_000) },
            { provider: "FLUTTERWAVE", status: "DEGRADED" as const, checkedAt: iso(now() - 45_000) },
            { provider: "BACHS", status: "UP" as const, checkedAt: iso(now() - 60_000) },
          ],
        };
      }),

    /** @endpoint GET /api/v1/admin/payments?page&pageSize&search&direction&status&provider&from&to → Page<AdminPayment> (payments:read) */
    listPayments: (query = {}) =>
      call("payments:read", () =>
        page(
          payments.filter(
            (p) =>
              (query.direction === undefined || p.direction === query.direction) &&
              (query.status === undefined || p.status === query.status) &&
              (query.provider === undefined || p.provider === query.provider) &&
              match(`${p.reference} ${p.userEmail}`, query.search),
          ),
          query.page,
          query.pageSize,
        ),
      ),

    /** @endpoint POST /api/v1/admin/payments/withdrawals/:reference/review { decision, reason } → AdminPayment (payments:write, audit-logged) */
    reviewWithdrawal: (reference, review) =>
      call("payments:write", () => {
        const payment = payments.find((p) => p.reference === reference && p.direction === "WITHDRAWAL");

        if (payment === undefined) throw new DataSourceError("NOT_FOUND", "There is no withdrawal with that reference.");
        if (payment.status !== "PENDING") throw new DataSourceError("CONFLICT", "Only a pending withdrawal can be reviewed.");

        Object.assign(payment, { status: review.decision === "APPROVE" ? "PROCESSING" : "CANCELLED", updatedAt: iso(now()), ...(review.decision === "REJECT" ? { failureReason: review.reason } : {}) });

        return { ...payment };
      }),

    /** @endpoint GET /api/v1/admin/responsible-gaming?page&pageSize&search&flag → Page<ResponsibleGamingAccount> (users:read) */
    listResponsibleGaming: (query = {}) =>
      call("users:read", () => page(responsible.filter((a) => (query.flag === undefined || a.flags.includes(query.flag as never)) && match(`${a.displayName} ${a.email}`, query.search)), query.page, query.pageSize)),
  };
}
