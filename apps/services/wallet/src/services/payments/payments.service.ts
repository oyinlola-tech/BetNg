import { randomBytes } from "node:crypto";
import type {
  DepositInitiateRequest,
  DepositInitiation,
  Page,
  PaymentOverview,
  PaymentRecord,
  WithdrawalQuote,
  WithdrawalRequest,
} from "@betng/contracts";
import type { Actor, Logger } from "@betng/service-kit";
import type { PaymentSettings } from "../../configs/index.js";
import {
  AUDIT_ACTION,
  PAYMENT_ERROR,
  QUOTE_TTL_MS,
  SAFE_REASON,
} from "../../constants/payments.constant.js";
import type { ProviderId } from "../../constants/payments.constant.js";
import type { SignalPublisher } from "../../clients/event.client.js";
import type { IdentityPeer, LimitAction } from "../../clients/identity.client.js";
import { paymentErrors } from "../../errors/index.js";
import type { WalletRepository } from "../../interfaces/index.js";
import {
  ProviderRefusedError,
  ProviderUnavailableError,
  WebhookRejectedError,
} from "../../providers/index.js";
import type { HeaderReader, PaymentProvider, ProviderOutcome, ProviderRegistry } from "../../providers/index.js";
import type { BankAccountsRepository } from "../../repositories/bankAccounts.repository.js";
import { isUniqueViolation } from "../../repositories/payments.repository.js";
import type { AdminFilter, HistoryFilter, PaymentRow, PaymentsRepository, Settled } from "../../repositories/payments.repository.js";
import type { FieldCipher } from "../../security/crypto.js";
import { formatKobo } from "../../statements/statement.render.js";
import { toAdminPayment, toPaymentRecord, utcToday } from "../../utils/index.js";
import type { AdminPaymentDto } from "../../utils/index.js";

export interface PaymentsServiceDeps {
  readonly settings: PaymentSettings;
  readonly registry: ProviderRegistry;
  readonly payments: PaymentsRepository;
  readonly bankAccounts: BankAccountsRepository;
  readonly wallets: WalletRepository;
  readonly identity: IdentityPeer;
  readonly signals: SignalPublisher;
  readonly cipher: FieldCipher | undefined;
  readonly logger: Logger;
}

export type WebhookRoute = "paystack" | "flutterwave" | "bachs";

const ROUTE_PROVIDER: Readonly<Record<WebhookRoute, ProviderId>> = Object.freeze({
  paystack: "PAYSTACK",
  flutterwave: "FLUTTERWAVE",
  bachs: "BACHS",
});

const OPEN_STATUSES: ReadonlySet<string> = new Set(["INITIATED", "PENDING", "PROCESSING"]);

function newReference(kind: "d" | "w"): string {
  return `bng${kind}-${randomBytes(12).toString("hex")}`;
}

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return url.protocol === "https:" && url.hostname.includes(".") && url.username === "" && url.password === "";
  } catch {
    return false;
  }
}

export class PaymentsService {
  private readonly deps: PaymentsServiceDeps;

  public constructor(deps: PaymentsServiceDeps) {
    this.deps = deps;
  }

  private activeProvider(): PaymentProvider {
    const provider = this.deps.registry.active;

    if (provider === undefined || !provider.configured) {
      throw paymentErrors.providerUnavailable();
    }

    return provider;
  }

  private providerOf(row: PaymentRow): PaymentProvider {
    const provider = this.deps.registry.get(row.provider as ProviderId);

    if (provider === undefined || !provider.configured) {
      throw paymentErrors.providerUnavailable();
    }

    return provider;
  }

  private async accountId(userId: string): Promise<string> {
    return (await this.deps.wallets.getOrOpenAccount("CUSTOMER", userId)).id;
  }

  private callbackUrl(returnPath: string | undefined): string {
    const base = this.deps.settings.callbackBaseUrl;

    if (base === undefined) {
      throw paymentErrors.notConfigured("The payment return address");
    }

    const path = returnPath ?? this.deps.settings.defaultReturnPath;

    if (path.startsWith("//") || path.includes("..") || path.includes("\\")) {
      throw paymentErrors.invalid("The return path must be a path on this site.");
    }

    const url = new URL(`${base}${path}`);

    if (url.origin !== new URL(base).origin) {
      throw paymentErrors.invalid("The return path must be a path on this site.");
    }

    return url.toString();
  }

  /** limits.check first, then the KYC tier's daily cap. Both fail closed. */
  private async gate(userId: string, action: LimitAction, amount: number, requestId: string): Promise<void> {
    let decision;

    try {
      decision = await this.deps.identity.checkLimit(userId, action, amount, requestId);
    } catch {
      throw paymentErrors.identityUnavailable();
    }

    if (!decision.allowed) {
      throw paymentErrors.limitRefused(decision.code, decision.message);
    }

    let kyc;

    try {
      kyc = await this.deps.identity.kycStatus(userId, requestId);
    } catch {
      throw paymentErrors.identityUnavailable();
    }

    const cap = action === "DEPOSIT" ? kyc.dailyDeposit : kyc.dailyWithdrawal;

    if (action === "WITHDRAWAL" && cap === undefined && kyc.status !== "VERIFIED") {
      throw paymentErrors.kycRequired("Verify your identity before withdrawing.");
    }

    if (cap !== undefined) {
      const used = await this.deps.payments.usedToday(userId, action, utcToday().from);

      if (used + BigInt(amount) > BigInt(cap)) {
        throw paymentErrors.kycRequired(
          `Your verification level allows NGN ${formatKobo(BigInt(cap))} of ${action === "DEPOSIT" ? "deposits" : "withdrawals"} a day.`,
          cap,
        );
      }
    }
  }

  private async notify(settled: Settled, requestId: string): Promise<void> {
    const { payment, transitioned } = settled;

    if (transitioned === undefined) {
      return;
    }

    this.deps.signals.walletChanged(payment.userId, requestId);

    if (OPEN_STATUSES.has(transitioned)) {
      return;
    }

    const amount = `NGN ${formatKobo(payment.amount)}`;
    const deposit = payment.direction === "DEPOSIT";
    const confirmed = transitioned === "CONFIRMED";
    const title = deposit
      ? confirmed
        ? "Deposit received"
        : "Deposit not completed"
      : confirmed
        ? "Withdrawal sent"
        : "Withdrawal returned";
    const body = deposit
      ? confirmed
        ? `${amount} has been added to your wallet.`
        : `Your deposit of ${amount} was not completed.`
      : confirmed
        ? `${formatKobo(payment.netAmount)} naira is on its way to your bank account.`
        : `${amount} is back in your wallet.`;

    await this.deps.identity.notify(
      {
        customerId: payment.userId,
        title,
        body,
        data: { reference: payment.reference, direction: payment.direction, status: transitioned, amount: Number(payment.amount) },
        dedupeKey: `payment:${payment.reference}:${transitioned}`,
      },
      requestId,
    );
  }

  private initiation(row: PaymentRow): DepositInitiation {
    const instructions = row.instructions as { title?: unknown; lines?: unknown } | null;

    return {
      payment: toPaymentRecord(row),
      ...(row.checkoutUrl === null ? {} : { checkoutUrl: row.checkoutUrl }),
      ...(instructions !== null && typeof instructions.title === "string" && Array.isArray(instructions.lines)
        ? { instructions: { title: instructions.title, lines: instructions.lines.filter((line): line is string => typeof line === "string") } }
        : {}),
      expiresAt: (row.expiresAt ?? row.createdAt).toISOString(),
    };
  }

  private replayInitiation(row: PaymentRow, request: DepositInitiateRequest): DepositInitiation {
    if (row.direction !== "DEPOSIT" || row.amount !== BigInt(request.amount) || row.method !== request.method) {
      throw paymentErrors.conflict("That idempotency key was already used for a different payment.");
    }

    if (row.errorCode === PAYMENT_ERROR.PAYMENT_PROVIDER_UNAVAILABLE) {
      throw paymentErrors.providerUnavailable();
    }

    if (row.errorCode === PAYMENT_ERROR.PAYMENT_FAILED) {
      throw paymentErrors.paymentFailed();
    }

    if (row.status === "INITIATED") {
      throw paymentErrors.conflict("This deposit is still being set up. Check its status shortly.");
    }

    return this.initiation(row);
  }

  public async initiateDeposit(
    userId: string,
    request: DepositInitiateRequest,
    clientKey: string,
    requestId: string,
  ): Promise<DepositInitiation> {
    const key = `deposit:${clientKey}`;
    const existing = await this.deps.payments.findByKey(userId, key);

    if (existing !== undefined) {
      return this.replayInitiation(existing, request);
    }

    const provider = this.activeProvider();
    const { depositMinKobo, depositMaxKobo, depositTtlMs } = this.deps.settings;

    if (request.amount < depositMinKobo || request.amount > depositMaxKobo) {
      throw paymentErrors.invalid(`A deposit must be between NGN ${formatKobo(BigInt(depositMinKobo))} and NGN ${formatKobo(BigInt(depositMaxKobo))}.`);
    }

    const callbackUrl = this.callbackUrl(request.returnPath);

    await this.gate(userId, "DEPOSIT", request.amount, requestId);

    const contact = await this.deps.payments.customerContact(userId);

    if (contact?.status !== "ACTIVE") {
      throw paymentErrors.forbidden("This account cannot make payments.");
    }

    await this.accountId(userId);

    let row: PaymentRow;

    try {
      row = await this.deps.payments.insertDeposit({
        userId,
        reference: newReference("d"),
        amount: request.amount,
        method: request.method,
        provider: provider.id,
        idempotencyKey: key,
        expiresAt: new Date(Date.now() + depositTtlMs),
      });
    } catch (error) {
      const raced = isUniqueViolation(error) ? await this.deps.payments.findByKey(userId, key) : undefined;

      if (raced === undefined) {
        throw error;
      }

      return this.replayInitiation(raced, request);
    }

    let result;

    try {
      result = await provider.initiateDeposit({
        reference: row.reference,
        amount: request.amount,
        method: request.method,
        email: contact.email,
        callbackUrl,
      });

      if (result.checkoutUrl !== undefined && !isHttpsUrl(result.checkoutUrl)) {
        throw new ProviderUnavailableError(provider.id, "checkout URL is not https");
      }
    } catch (error) {
      if (error instanceof ProviderRefusedError) {
        await this.deps.payments.recordInitiationFailure(row.id, PAYMENT_ERROR.PAYMENT_FAILED, SAFE_REASON.PROVIDER_DECLINED);
        this.deps.logger.warn("Deposit refused by provider", { requestId, event: "deposit_refused", provider: provider.id, status: error.status });
        throw paymentErrors.paymentFailed();
      }

      await this.deps.payments.recordInitiationFailure(row.id, PAYMENT_ERROR.PAYMENT_PROVIDER_UNAVAILABLE, SAFE_REASON.PROVIDER_UNAVAILABLE);
      this.deps.logger.warn("Deposit provider unavailable", { requestId, event: "deposit_unavailable", provider: provider.id });
      throw paymentErrors.providerUnavailable();
    }

    return this.initiation(await this.deps.payments.recordInitiation(row.id, result));
  }

  private async refreshDeposit(row: PaymentRow, expire: boolean, requestId: string, eventId?: string): Promise<PaymentRow> {
    if (!OPEN_STATUSES.has(row.status) && eventId === undefined) {
      return row;
    }

    if (row.flaggedAt !== null && eventId === undefined) {
      return row;
    }

    const provider = this.providerOf(row);
    const attempt = await this.deps.payments.nextCheck(row.id);
    let outcome: ProviderOutcome;

    try {
      outcome = await provider.verifyDeposit({
        reference: row.reference,
        providerReference: row.providerReference ?? undefined,
        amount: Number(row.amount),
        attempt,
      });
    } catch (error) {
      if (error instanceof ProviderUnavailableError || error instanceof ProviderRefusedError) {
        throw paymentErrors.providerUnavailable();
      }

      throw error;
    }

    const settled = await this.deps.payments.settleDeposit(row.id, await this.accountId(row.userId), outcome, { expire, eventId });

    await this.notify(settled, requestId);

    return settled.payment;
  }

  public async verifyDeposit(userId: string, reference: string, requestId: string): Promise<PaymentRecord> {
    const row = await this.deps.payments.findOwned(userId, reference, "DEPOSIT");

    if (row === undefined) {
      throw paymentErrors.notFound();
    }

    return toPaymentRecord(await this.refreshDeposit(row, false, requestId));
  }

  public async history(userId: string, filter: HistoryFilter): Promise<Page<PaymentRecord>> {
    const { items, total } = await this.deps.payments.history(userId, filter);

    return { items: items.map(toPaymentRecord), page: filter.page, pageSize: filter.pageSize, total };
  }

  private fee(amount: number): number {
    const { standardKobo, highKobo, highFromKobo } = this.deps.settings.withdrawalFee;

    return amount >= highFromKobo ? highKobo : standardKobo;
  }

  private checkWithdrawalAmount(amount: number): number {
    const { withdrawalMinKobo, withdrawalMaxKobo } = this.deps.settings;

    if (amount < withdrawalMinKobo || amount > withdrawalMaxKobo) {
      throw paymentErrors.invalid(
        `A withdrawal must be between NGN ${formatKobo(BigInt(withdrawalMinKobo))} and NGN ${formatKobo(BigInt(withdrawalMaxKobo))}.`,
      );
    }

    return this.fee(amount);
  }

  public async quote(userId: string, request: WithdrawalRequest): Promise<WithdrawalQuote> {
    this.activeProvider();

    const fee = this.checkWithdrawalAmount(request.amount);

    if ((await this.deps.bankAccounts.findOwned(userId, request.bankAccountId)) === undefined) {
      throw paymentErrors.notFound("That bank account is not on your profile.");
    }

    return {
      amount: request.amount,
      fee,
      netAmount: request.amount - fee,
      currency: "NGN",
      expiresAt: new Date(Date.now() + QUOTE_TTL_MS).toISOString(),
    };
  }

  private replayWithdrawal(row: PaymentRow, request: WithdrawalRequest): PaymentRecord {
    if (row.direction !== "WITHDRAWAL" || row.amount !== BigInt(request.amount) || row.bankAccountId !== request.bankAccountId) {
      throw paymentErrors.conflict("That idempotency key was already used for a different payment.");
    }

    return toPaymentRecord(row);
  }

  public async requestWithdrawal(
    userId: string,
    request: WithdrawalRequest,
    clientKey: string,
    requestId: string,
  ): Promise<PaymentRecord> {
    const key = `withdrawal:${clientKey}`;
    const existing = await this.deps.payments.findByKey(userId, key);

    if (existing !== undefined) {
      return this.replayWithdrawal(existing, request);
    }

    const provider = this.activeProvider();
    const fee = this.checkWithdrawalAmount(request.amount);

    if ((await this.deps.bankAccounts.findOwned(userId, request.bankAccountId)) === undefined) {
      throw paymentErrors.notFound("That bank account is not on your profile.");
    }

    await this.gate(userId, "WITHDRAWAL", request.amount, requestId);

    let row: PaymentRow;

    try {
      row = await this.deps.payments.createWithdrawal({
        userId,
        accountId: await this.accountId(userId),
        reference: newReference("w"),
        amount: request.amount,
        fee,
        provider: provider.id,
        idempotencyKey: key,
        bankAccountId: request.bankAccountId,
        reviewStatus: request.amount > this.deps.settings.withdrawalReviewThresholdKobo ? "REQUIRED" : "NOT_REQUIRED",
      });
    } catch (error) {
      const raced = isUniqueViolation(error) ? await this.deps.payments.findByKey(userId, key) : undefined;

      if (raced === undefined) {
        throw error;
      }

      return this.replayWithdrawal(raced, request);
    }

    this.deps.signals.walletChanged(userId, requestId);

    if (row.reviewStatus === "NOT_REQUIRED") {
      row = (await this.dispatchQuietly(row.id, requestId)) ?? row;
    }

    return toPaymentRecord(row);
  }

  public async withdrawalStatus(userId: string, reference: string): Promise<PaymentRecord> {
    const row = await this.deps.payments.findOwned(userId, reference, "WITHDRAWAL");

    if (row === undefined) {
      throw paymentErrors.notFound();
    }

    return toPaymentRecord(row);
  }

  private async dispatchQuietly(paymentId: string, requestId: string): Promise<PaymentRow | undefined> {
    try {
      return await this.dispatch(paymentId, requestId);
    } catch (error) {
      this.deps.logger.error("Withdrawal dispatch failed; the poll job retries it", {
        requestId,
        event: "withdrawal_dispatch_failed",
        error: error instanceof Error ? error.name : "unknown",
      });

      return undefined;
    }
  }

  /** Sends the transfer once; a retry first asks the provider whether the earlier attempt landed. */
  public async dispatch(paymentId: string, requestId: string): Promise<PaymentRow | undefined> {
    const claim = await this.deps.payments.claimTransfer(paymentId);

    if (claim === undefined) {
      return undefined;
    }

    const { payment, retry } = claim;
    const provider = this.deps.registry.get(payment.provider as ProviderId);
    const accountId = await this.accountId(payment.userId);

    if (provider === undefined || !provider.configured) {
      this.deps.logger.error("Withdrawal provider is not available", { requestId, event: "withdrawal_provider_missing", provider: payment.provider });

      return payment;
    }

    if (retry) {
      const attempt = await this.deps.payments.nextCheck(payment.id);
      const status = await provider.transferStatus({
        reference: payment.reference,
        providerReference: payment.providerReference ?? undefined,
        amount: Number(payment.netAmount),
        attempt,
      });

      if (status.kind !== "NOT_FOUND") {
        const settled = await this.deps.payments.settleWithdrawal(payment.id, accountId, status);

        await this.notify(settled, requestId);

        return settled.payment;
      }
    }

    const bank = payment.bankAccountId === null ? undefined : await this.deps.bankAccounts.findById(payment.bankAccountId);

    if (bank?.accountNumberEncrypted === null || bank === undefined || this.deps.cipher === undefined) {
      const settled = await this.deps.payments.failWithdrawal(payment.id, accountId, SAFE_REASON.TRANSFER_FAILED);

      await this.notify(settled, requestId);

      return settled.payment;
    }

    let result;

    try {
      result = await provider.transfer({
        reference: payment.reference,
        amount: Number(payment.netAmount),
        bankCode: bank.bankCode,
        accountNumber: this.deps.cipher.decrypt(bank.accountNumberEncrypted, bank.userId),
        accountName: bank.accountName,
        recipientCode: bank.provider === provider.id ? (bank.recipientCode ?? undefined) : undefined,
        narration: `BetNG withdrawal ${payment.reference}`,
      });
    } catch (error) {
      if (error instanceof ProviderRefusedError) {
        if (retry) {
          return this.deps.payments.flag(payment.id, "The provider refused a resubmitted transfer; confirm its state with the provider.");
        }

        this.deps.logger.warn("Transfer refused by provider", { requestId, event: "transfer_refused", provider: provider.id, status: error.status });

        const settled = await this.deps.payments.failWithdrawal(payment.id, accountId, SAFE_REASON.TRANSFER_FAILED);

        await this.notify(settled, requestId);

        return settled.payment;
      }

      if (error instanceof ProviderUnavailableError) {
        this.deps.logger.warn("Transfer provider unavailable; will retry", { requestId, event: "transfer_unavailable", provider: provider.id });

        return payment;
      }

      throw error;
    }

    await this.deps.payments.recordTransfer(payment.id, result.providerReference);

    if (result.recipientCode !== undefined && result.recipientCode !== bank.recipientCode) {
      await this.deps.bankAccounts.setRecipientCode(bank.id, result.recipientCode);
    }

    const settled = await this.deps.payments.settleWithdrawal(payment.id, accountId, result.outcome);

    await this.notify(settled, requestId);

    return settled.payment;
  }

  private async refreshWithdrawal(row: PaymentRow, requestId: string, eventId?: string): Promise<PaymentRow> {
    const trackable = row.status === "PROCESSING" || (row.status === "PENDING" && row.transferRequestedAt !== null) || row.status === "CONFIRMED";

    if (!trackable) {
      return row;
    }

    const provider = this.providerOf(row);
    const attempt = await this.deps.payments.nextCheck(row.id);
    let outcome: ProviderOutcome;

    try {
      outcome = await provider.transferStatus({
        reference: row.reference,
        providerReference: row.providerReference ?? undefined,
        amount: Number(row.netAmount),
        attempt,
      });
    } catch (error) {
      if (error instanceof ProviderUnavailableError || error instanceof ProviderRefusedError) {
        throw paymentErrors.providerUnavailable();
      }

      throw error;
    }

    const settled = await this.deps.payments.settleWithdrawal(row.id, await this.accountId(row.userId), outcome, eventId);

    await this.notify(settled, requestId);

    return settled.payment;
  }

  /** Signature over the raw bytes first; nothing in the body is read before it verifies. */
  public async handleWebhook(route: WebhookRoute, rawBody: Uint8Array, header: HeaderReader, requestId: string): Promise<string> {
    const provider = this.deps.registry.get(ROUTE_PROVIDER[route]);

    if (provider === undefined) {
      throw paymentErrors.unauthenticatedWebhook();
    }

    let event;

    try {
      event = provider.parseWebhook(rawBody, header);
    } catch (error) {
      if (error instanceof WebhookRejectedError) {
        this.deps.logger.warn("Webhook rejected", { requestId, event: "webhook_rejected", provider: provider.id });
        throw paymentErrors.unauthenticatedWebhook();
      }

      throw error;
    }

    const state = await this.deps.payments.recordWebhookEvent(provider.id, event.eventId, event.eventType, event.reference);

    if (state === "DONE") {
      return "duplicate";
    }

    const outcome = await this.applyWebhook(provider.id, event, requestId);

    await this.deps.payments.completeWebhookEvent(provider.id, event.eventId, outcome);

    return outcome;
  }

  private async applyWebhook(
    provider: ProviderId,
    event: { eventId: string; subject: string; reference: string | undefined; amount: number | undefined; currency: string | undefined },
    requestId: string,
  ): Promise<string> {
    if (event.subject === "IGNORED" || event.reference === undefined) {
      return "IGNORED";
    }

    const row = await this.deps.payments.findByReference(event.reference);

    if (row?.provider !== provider) {
      return "UNKNOWN_REFERENCE";
    }

    const expected = event.subject === "DEPOSIT" ? row.amount : row.netAmount;
    const mismatch =
      (event.amount !== undefined && BigInt(event.amount) !== expected) ||
      (event.currency !== undefined && event.currency.toUpperCase() !== row.currency);

    if (event.subject === "DEPOSIT" && row.direction === "DEPOSIT") {
      if (mismatch) {
        await this.deps.payments.flag(row.id, SAFE_REASON.AMOUNT_MISMATCH, event.eventId);

        return "FLAGGED";
      }

      return (await this.refreshDeposit(row, false, requestId, event.eventId)).status;
    }

    if (event.subject === "TRANSFER" && row.direction === "WITHDRAWAL") {
      if (mismatch) {
        await this.deps.payments.flag(row.id, "The transfer amount reported by the provider does not match.", event.eventId);

        return "FLAGGED";
      }

      return (await this.refreshWithdrawal(row, requestId, event.eventId)).status;
    }

    return "IGNORED";
  }

  public async pendingWithdrawals(userId: string): Promise<number> {
    return Number(await this.deps.payments.inFlightWithdrawals(userId));
  }

  public async expireDeposits(now: Date, requestId: string): Promise<number> {
    let processed = 0;

    for (const row of await this.deps.payments.dueDeposits(now, 50)) {
      try {
        await this.refreshDeposit(row, true, requestId);
        processed += 1;
      } catch (error) {
        this.deps.logger.warn("Deposit expiry check failed", { requestId, event: "deposit_expiry_failed", error: error instanceof Error ? error.name : "unknown" });
      }
    }

    return processed;
  }

  public async pollWithdrawals(requestId: string): Promise<number> {
    let processed = 0;

    for (const row of await this.deps.payments.dueWithdrawals(50)) {
      try {
        if (row.status === "PENDING") {
          await this.dispatch(row.id, requestId);
        } else {
          await this.refreshWithdrawal(row, requestId);
        }

        processed += 1;
      } catch (error) {
        this.deps.logger.warn("Withdrawal poll failed", { requestId, event: "withdrawal_poll_failed", error: error instanceof Error ? error.name : "unknown" });
      }
    }

    return processed;
  }

  public async overview(): Promise<PaymentOverview> {
    const [figures, health] = await Promise.all([this.deps.payments.overview(utcToday().from), this.deps.registry.health()]);

    return {
      depositsToday: Number(figures.depositsToday),
      withdrawalsToday: Number(figures.withdrawalsToday),
      pendingDeposits: figures.pendingDeposits,
      pendingWithdrawals: figures.pendingWithdrawals,
      failedToday: figures.failedToday,
      providers: health.map((entry) => ({ provider: entry.provider, status: entry.status, checkedAt: entry.checkedAt })),
    };
  }

  public async adminPage(filter: AdminFilter): Promise<Page<AdminPaymentDto>> {
    const { items, total } = await this.deps.payments.adminPage(filter);

    return { items: items.map(toAdminPayment), page: filter.page, pageSize: filter.pageSize, total };
  }

  public async review(
    reference: string,
    decision: "APPROVE" | "REJECT",
    reason: string,
    actor: Actor,
    requestId: string,
  ): Promise<AdminPaymentDto> {
    const row = await this.deps.payments.adminOne(reference);

    if (row?.direction !== "WITHDRAWAL") {
      throw paymentErrors.notFound();
    }

    if (row.reviewStatus !== "REQUIRED" || row.status !== "PENDING") {
      throw paymentErrors.conflict("This withdrawal is not waiting for review.");
    }

    try {
      await this.deps.identity.recordAudit(
        {
          actorId: actor.id,
          actorRole: actor.role === "" ? "ADMIN" : actor.role,
          actorName: actor.name === "" ? actor.id : actor.name.slice(0, 80),
          action: decision === "APPROVE" ? AUDIT_ACTION.WITHDRAWAL_APPROVED : AUDIT_ACTION.WITHDRAWAL_REJECTED,
          entityType: "payment",
          entityId: reference,
          before: { status: row.status, reviewStatus: row.reviewStatus, amount: Number(row.amount) },
          after: { reviewStatus: decision === "APPROVE" ? "APPROVED" : "REJECTED" },
          reason,
          severity: "WARNING",
        },
        requestId,
      );
    } catch {
      throw paymentErrors.identityUnavailable();
    }

    const settled = await this.deps.payments.review(row.id, await this.accountId(row.userId), decision, { id: actor.id, reason });

    if (settled.transitioned === undefined) {
      throw paymentErrors.conflict("This withdrawal changed while it was being reviewed.");
    }

    if (decision === "APPROVE") {
      await this.dispatchQuietly(row.id, requestId);
    } else {
      await this.notify(settled, requestId);
    }

    const latest = await this.deps.payments.adminOne(reference);

    return toAdminPayment(latest ?? row);
  }
}
