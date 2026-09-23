import { randomUUID } from "node:crypto";
import { NGN_DENOMINATIONS } from "@betng/contracts";
import type {
  CashierShift,
  CashMovementRequest,
  CloseShiftRequest,
  FloatTransfer,
  FloatTransferRequest,
  OpenShiftRequest,
  ShiftTotals,
} from "@betng/contracts";
import type { Actor } from "@betng/service-kit";
import type { SignalPublisher } from "../../clients/event.client.js";
import type { IdentityPeer } from "../../clients/identity.client.js";
import { MAX_LIST_LIMIT } from "../../constants/index.js";
import { SHOP_PERMISSION } from "../../constants/payments.constant.js";
import { paymentErrors } from "../../errors/index.js";
import type { TimeRange, WalletRepository } from "../../interfaces/index.js";
import { isUniqueViolation } from "../../repositories/payments.repository.js";
import type { ShiftRow, ShiftsRepository } from "../../repositories/shifts.repository.js";
import { toKobo, toShift } from "../../utils/index.js";

export interface ShiftsServiceDeps {
  readonly shifts: ShiftsRepository;
  readonly wallets: WalletRepository;
  readonly identity: IdentityPeer;
  readonly signals: SignalPublisher;
}

export interface CashierContext {
  readonly cashierId: string;
  readonly shopId: string;
  readonly actor: Actor;
}

const DENOMINATIONS: ReadonlySet<number> = new Set(NGN_DENOMINATIONS);

function snapshot(value: unknown): ShiftTotals | undefined {
  const totals = value as Partial<Record<keyof ShiftTotals, unknown>> | null;
  const keys: (keyof ShiftTotals)[] = ["openingFloat", "sales", "payouts", "cancellations", "cashIn", "cashOut", "expectedCash", "ticketsSold"];

  if (totals === null || typeof totals !== "object" || !keys.every((key) => Number.isSafeInteger(totals[key]))) {
    return undefined;
  }

  return Object.fromEntries(keys.map((key) => [key, totals[key]])) as unknown as ShiftTotals;
}

export class ShiftsService {
  private readonly deps: ShiftsServiceDeps;

  public constructor(deps: ShiftsServiceDeps) {
    this.deps = deps;
  }

  private async totals(shift: ShiftRow, until: Date): Promise<ShiftTotals> {
    const ledger = await this.deps.shifts.ledgerTotals(shift.shopId, shift.cashierId, shift.openedAt, until);
    const expected = shift.openingFloat + ledger.sales - ledger.payouts - ledger.cancellations + ledger.cashIn - ledger.cashOut;

    return {
      openingFloat: toKobo(shift.openingFloat),
      sales: toKobo(ledger.sales),
      payouts: toKobo(ledger.payouts),
      cancellations: toKobo(ledger.cancellations),
      cashIn: toKobo(ledger.cashIn),
      cashOut: toKobo(ledger.cashOut),
      expectedCash: toKobo(expected),
      ticketsSold: ledger.ticketsSold,
    };
  }

  private async view(shift: ShiftRow): Promise<CashierShift> {
    const closed = shift.status === "CLOSED" || shift.status === "RECONCILED" ? snapshot(shift.totals) : undefined;

    return toShift(shift, closed ?? (await this.totals(shift, shift.closedAt ?? new Date())));
  }

  private async cashierName(context: CashierContext): Promise<string> {
    const name = await this.deps.shifts.cashierOfShop(context.cashierId, context.shopId);

    if (name === undefined) {
      throw paymentErrors.forbidden("You are not an active cashier of this shop.");
    }

    return name;
  }

  public async current(context: CashierContext): Promise<{ readonly shift: CashierShift | null }> {
    const shift = await this.deps.shifts.findOpen(context.cashierId);

    return { shift: shift === undefined || shift.shopId !== context.shopId ? null : await this.view(shift) };
  }

  public async open(context: CashierContext, request: OpenShiftRequest, key: string): Promise<CashierShift> {
    const replay = await this.deps.shifts.findByOpenKey(context.cashierId, key);

    if (replay !== undefined) {
      if (replay.openingFloat !== BigInt(request.openingFloat) || replay.shopId !== context.shopId) {
        throw paymentErrors.conflict("That idempotency key was already used for a different shift.");
      }

      return this.view(replay);
    }

    const cashierName = await this.cashierName(context);

    if ((await this.deps.shifts.findOpen(context.cashierId)) !== undefined) {
      throw paymentErrors.conflict("You already have an open shift. Close it before opening another.");
    }

    try {
      return await this.view(
        await this.deps.shifts.open({
          shopId: context.shopId,
          cashierId: context.cashierId,
          cashierName,
          openingFloat: request.openingFloat,
          idempotencyKey: key,
        }),
      );
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }

      const raced = await this.deps.shifts.findByOpenKey(context.cashierId, key);

      if (raced !== undefined && raced.openingFloat === BigInt(request.openingFloat)) {
        return this.view(raced);
      }

      throw paymentErrors.conflict("You already have an open shift. Close it before opening another.");
    }
  }

  public async moveCash(context: CashierContext, request: CashMovementRequest, key: string, requestId: string): Promise<CashierShift> {
    await this.cashierName(context);

    const shift = await this.deps.shifts.findOpen(context.cashierId);

    if (shift?.status !== "OPEN" || shift.shopId !== context.shopId) {
      throw paymentErrors.conflict("Open a shift before moving cash.");
    }

    const amount = BigInt(request.amount);

    await this.deps.wallets.postEntry({
      ownerType: "SHOP",
      ownerId: context.shopId,
      type: request.type,
      amount: request.type === "CASH_IN" ? amount : -amount,
      idempotencyKey: `cash:${shift.id}:${key}`,
      reference: `shift:${shift.id}`,
      note: request.note.trim(),
      actorId: context.cashierId,
    });

    this.deps.signals.shopChanged(context.shopId, requestId);

    return this.view(shift);
  }

  /**
   * Float from one open drawer to another in the same shop. The shop's balance is the same before and
   * after: a `CASH_OUT` attributed to the sender and a matching `CASH_IN` attributed to the receiver, both
   * on the shop account, committed together with the record of the transfer.
   *
   * A cashier may only send from their own drawer, and re-enters their PIN to do it. An owner or a manager
   * may move float between any two open drawers in their shop.
   */
  public async transferFloat(
    context: CashierContext,
    request: FloatTransferRequest,
    key: string,
    requestId: string,
  ): Promise<{ readonly id: string; readonly duplicate: boolean; readonly from: CashierShift }> {
    const mayMoveAnyDrawer = context.actor.role === "OWNER" || context.actor.role === "MANAGER";

    if (request.toCashierId === context.cashierId) {
      throw paymentErrors.invalid("Choose a different cashier to send float to.");
    }

    // Identity is authoritative on who works here; a cashier who left has no drawer to receive into.
    const recipientName = await this.deps.shifts.cashierOfShop(request.toCashierId, context.shopId);

    if (recipientName === undefined) {
      throw paymentErrors.notFound("That cashier is not an active cashier of this shop.");
    }

    // The PIN proves the person at the terminal, exactly as it does for a ticket payout or a shift close.
    if (!(await this.deps.identity.verifyCashierPin(context.cashierId, request.pin, requestId))) {
      throw paymentErrors.invalid("That PIN is not correct.");
    }

    const [sender, recipient] = await Promise.all([
      this.deps.shifts.findOpen(context.cashierId),
      this.deps.shifts.findOpen(request.toCashierId),
    ]);

    if (sender?.status !== "OPEN" || sender.shopId !== context.shopId) {
      throw paymentErrors.conflict("Open a shift before moving float.");
    }

    if (recipient?.status !== "OPEN" || recipient.shopId !== context.shopId) {
      throw paymentErrors.conflict("That cashier has no open shift to receive float into.");
    }

    if (!mayMoveAnyDrawer && sender.cashierId !== context.cashierId) {
      throw paymentErrors.forbidden("You can only send float from your own drawer.");
    }

    // A drawer cannot go negative: what is expected in it is what can leave it.
    const totals = await this.totals(sender, new Date());

    if (totals.expectedCash < request.amount) {
      throw paymentErrors.invalid("That is more than the drawer holds.");
    }

    const result = await this.deps.wallets.postFloatTransfer({
      id: randomUUID(),
      shopId: context.shopId,
      fromShiftId: sender.id,
      fromCashierId: sender.cashierId,
      toShiftId: recipient.id,
      toCashierId: recipient.cashierId,
      amount: BigInt(request.amount),
      note: request.note.trim(),
      authorisedBy: context.cashierId,
      idempotencyKey: `transfer:${sender.id}:${key}`,
    });

    this.deps.signals.shopChanged(context.shopId, requestId);

    return { ...result, from: await this.view(sender) };
  }

  public async listTransfers(context: CashierContext, range: TimeRange): Promise<readonly FloatTransfer[]> {
    await this.cashierName(context);

    const rows = await this.deps.shifts.listTransfers(context.shopId, range, MAX_LIST_LIMIT);

    return rows.map((row) => ({
      id: row.id,
      fromCashierId: row.fromCashierId,
      fromCashierName: row.fromCashierName,
      toCashierId: row.toCashierId,
      toCashierName: row.toCashierName,
      amount: toKobo(row.amount),
      note: row.note,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  public async close(context: CashierContext, id: string, request: CloseShiftRequest, key: string, requestId: string): Promise<CashierShift> {
    const existing = await this.deps.shifts.findOwned(id, context.cashierId);

    if (existing === undefined || existing.shopId !== context.shopId) {
      throw paymentErrors.notFound("No shift of yours matches that id.");
    }

    if (existing.status !== "OPEN") {
      if (existing.closeIdempotencyKey === key) {
        return this.view(existing);
      }

      throw paymentErrors.conflict("This shift is already closed.");
    }

    const seen = new Set<number>();
    let countedCash = 0n;

    for (const entry of request.counted) {
      if (!DENOMINATIONS.has(entry.denomination) || seen.has(entry.denomination)) {
        throw paymentErrors.invalid("Count each naira denomination once.");
      }

      seen.add(entry.denomination);
      countedCash += BigInt(entry.denomination) * BigInt(entry.count);
    }

    toKobo(countedCash);

    let valid: boolean;

    try {
      valid = await this.deps.identity.verifyCashierPin(context.cashierId, request.pin, requestId);
    } catch {
      throw paymentErrors.identityUnavailable();
    }

    if (!valid) {
      throw paymentErrors.forbidden("The PIN is not correct.");
    }

    const outcome = await this.deps.shifts.close(id, context.cashierId, async (shift) => {
      const closedAt = new Date();
      const totals = await this.totals(shift, closedAt);

      return {
        closedAt,
        totals: { ...totals },
        counted: request.counted.map((entry) => ({ denomination: entry.denomination, count: entry.count })),
        countedCash,
        expectedCash: BigInt(totals.expectedCash),
        note: request.note?.trim() === "" ? undefined : request.note?.trim(),
        idempotencyKey: key,
      };
    });

    if (outcome.kind === "MISSING") {
      throw paymentErrors.notFound("No shift of yours matches that id.");
    }

    if (outcome.kind === "NOT_OPEN") {
      if (outcome.shift.closeIdempotencyKey === key) {
        return this.view(outcome.shift);
      }

      throw paymentErrors.conflict("This shift is already closed.");
    }

    this.deps.signals.shopChanged(context.shopId, requestId);

    return this.view(outcome.shift);
  }

  public async list(context: CashierContext, range: TimeRange): Promise<{ readonly items: readonly CashierShift[] }> {
    const everyone = context.actor.permissions.includes(SHOP_PERMISSION.REPORTS_READ);
    const rows = await this.deps.shifts.list(context.shopId, everyone ? undefined : context.cashierId, range);

    return { items: await Promise.all(rows.map(async (row) => this.view(row))) };
  }
}
