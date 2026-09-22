import type {
  AdminPayment,
  BankAccount,
  BankAccountVerification,
  CashierShift,
  PaymentDirection,
  PaymentMethod,
  PaymentProvider,
  PaymentRecord,
  PaymentStatus,
  ShiftStatus,
  ShiftTotals,
  StatementFormat,
  StatementJob,
} from "@betng/contracts";
import { maskAccountNumber } from "../security/crypto.js";
import type { BankAccountRow, VerificationRow } from "../repositories/bankAccounts.repository.js";
import type { AdminPaymentRow, PaymentRow } from "../repositories/payments.repository.js";
import type { ShiftRow } from "../repositories/shifts.repository.js";
import type { StatementJobRow } from "../repositories/statements.repository.js";
import { toKobo } from "./wallet.mapper.js";

const PUBLIC_PROVIDERS: ReadonlySet<string> = new Set<PaymentProvider>(["PAYSTACK", "FLUTTERWAVE", "BACHS"]);

export function toPaymentRecord(row: PaymentRow): PaymentRecord {
  return {
    reference: row.reference,
    direction: row.direction as PaymentDirection,
    status: row.status as PaymentStatus,
    amount: toKobo(row.amount),
    fee: toKobo(row.fee),
    netAmount: toKobo(row.netAmount),
    currency: "NGN",
    ...(row.method === null ? {} : { method: row.method as PaymentMethod }),
    ...(PUBLIC_PROVIDERS.has(row.provider) ? { provider: row.provider as PaymentProvider } : {}),
    ...(row.bankAccountId === null ? {} : { bankAccountId: row.bankAccountId }),
    ...(row.failureReason === null ? {} : { failureReason: row.failureReason }),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ...(row.completedAt === null ? {} : { completedAt: row.completedAt.toISOString() }),
  };
}

export interface AdminPaymentDto extends AdminPayment {
  readonly reviewStatus: string;
  readonly flagReason?: string;
}

export function toAdminPayment(row: AdminPaymentRow): AdminPaymentDto {
  return {
    ...toPaymentRecord(row),
    userId: row.userId,
    userEmail: row.userEmail,
    ...(row.providerReference === null ? {} : { providerReference: row.providerReference }),
    reviewStatus: row.reviewStatus,
    ...(row.flagReason === null ? {} : { flagReason: row.flagReason }),
  };
}

export function toBankAccount(row: BankAccountRow): BankAccount {
  return {
    id: row.id,
    bankCode: row.bankCode,
    bankName: row.bankName,
    accountNumberMasked: maskAccountNumber(row.last4),
    accountName: row.accountName,
    isDefault: row.isDefault,
    verified: true,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toVerification(row: VerificationRow): BankAccountVerification {
  return {
    verificationId: row.id,
    bankCode: row.bankCode,
    accountName: row.accountName,
    accountNumberMasked: maskAccountNumber(row.last4),
    expiresAt: row.expiresAt.toISOString(),
  };
}

export function toShift(row: ShiftRow, totals: ShiftTotals): CashierShift {
  return {
    id: row.id,
    cashierId: row.cashierId,
    cashierName: row.cashierName,
    status: row.status as ShiftStatus,
    openedAt: row.openedAt.toISOString(),
    ...(row.closedAt === null ? {} : { closedAt: row.closedAt.toISOString() }),
    totals,
    ...(row.countedCash === null ? {} : { countedCash: toKobo(row.countedCash) }),
    ...(row.discrepancy === null ? {} : { discrepancy: toKobo(row.discrepancy) }),
    ...(row.discrepancyNote === null ? {} : { discrepancyNote: row.discrepancyNote }),
  };
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function toStatementJob(
  row: StatementJobRow,
  status: StatementJob["status"],
  download?: { readonly url: string; readonly expiresAt: Date },
): StatementJob {
  return {
    id: row.id,
    status,
    format: row.format as StatementFormat,
    from: isoDate(row.fromDate),
    to: isoDate(row.toDate),
    ...(download === undefined ? {} : { downloadUrl: download.url, expiresAt: download.expiresAt.toISOString() }),
    createdAt: row.createdAt.toISOString(),
  };
}
