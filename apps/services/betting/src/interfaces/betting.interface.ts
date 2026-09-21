/**
 * The betting service's persistence contract.
 *
 * A bet is written once and afterwards only resolved, so there is no general
 * `update`: each mutation below is one named, guarded transition. Money is
 * integer kobo and odds are integer hundredths in every record; nothing in
 * this service holds either as a float.
 */

import type { Bet, BetStatus, TicketStatus } from "@betng/contracts";

export type BetChannel = NonNullable<Bet["channel"]>;

export type LegOutcome = "PENDING" | "WON" | "LOST" | "VOID";

export type SettledOutcome = "WON" | "LOST" | "VOID";

export interface BetLegRecord {
  readonly matchId: string;
  readonly marketId: string;
  readonly selectionId: string;
  readonly leagueId: string;
  readonly marketType: string;
  readonly selectionCode: string;
  /** Tenths, e.g. 25 for a 2.5 line. */
  readonly lineTenths: number | undefined;
  readonly oddsHundredths: number;
  readonly oddsVersion: number;
  readonly marketLabel: string;
  readonly selectionLabel: string;
  readonly matchLabel: string;
  readonly leagueName: string;
  readonly kickoffAt: Date;
  readonly outcome: LegOutcome;
  readonly result: string | undefined;
}

export interface BetRecord {
  readonly id: string;
  readonly userId: string | undefined;
  readonly channel: BetChannel;
  readonly shopId: string | undefined;
  readonly cashierId: string | undefined;
  readonly stake: number;
  readonly currency: string;
  readonly totalOddsHundredths: number;
  readonly potentialPayout: number;
  readonly status: BetStatus;
  readonly payout: number | undefined;
  readonly placedAt: Date;
  readonly settledAt: Date | undefined;
  readonly cancelledAt: Date | undefined;
  readonly legs: readonly BetLegRecord[];
}

export interface TicketRecord {
  readonly id: string;
  readonly code: string;
  readonly shopId: string;
  readonly shopCode: string;
  readonly cashierId: string;
  readonly cashierName: string;
  readonly customerName: string | undefined;
  readonly customerPhone: string | undefined;
  /** As stored. `EXPIRED` is also derived at read time from `expiresAt`. */
  readonly status: TicketStatus;
  readonly paidAt: Date | undefined;
  readonly expiresAt: Date;
  readonly createdAt: Date;
  readonly bet: BetRecord;
}

export type NewBetLeg = Omit<BetLegRecord, "outcome" | "result">;

export interface NewTicket {
  readonly code: string;
  readonly shopId: string;
  readonly shopCode: string;
  readonly cashierId: string;
  readonly cashierName: string;
  readonly customerName: string | undefined;
  readonly customerPhone: string | undefined;
  readonly expiresAt: Date;
}

export interface NewBet {
  readonly id: string;
  readonly userId: string | undefined;
  readonly channel: BetChannel;
  readonly shopId: string | undefined;
  readonly cashierId: string | undefined;
  readonly stake: number;
  readonly currency: string;
  readonly totalOddsHundredths: number;
  readonly potentialPayout: number;
  readonly riskDecisionId: string;
  readonly idempotencyKey: string;
  readonly placedAt: Date;
  readonly legs: readonly NewBetLeg[];
  readonly ticket: NewTicket | undefined;
}

export interface BetFilter {
  readonly userId: string;
  readonly status: BetStatus | undefined;
  readonly limit: number;
}

export interface TicketFilter {
  readonly shopId: string;
  readonly status: TicketStatus | undefined;
  readonly search: string | undefined;
  /** Inclusive start and exclusive end of the day the ticket was sold on. */
  readonly soldBetween: readonly [Date, Date] | undefined;
  readonly limit: number;
  readonly now: Date;
}

export interface SettlementLeg {
  readonly selectionId: string;
  readonly outcome: SettledOutcome;
  readonly result: string | undefined;
}

export interface SettlementInput {
  readonly betId: string;
  readonly outcome: SettledOutcome;
  readonly payout: number;
  readonly legs: readonly SettlementLeg[];
  readonly settledAt: Date;
}

export type SettlementResult =
  | { readonly kind: "NOT_FOUND" }
  | { readonly kind: "UNKNOWN_LEG"; readonly selectionId: string }
  | { readonly kind: "INVALID_PAYOUT" }
  | { readonly kind: "CONFLICT"; readonly status: BetStatus }
  | { readonly kind: "APPLIED" | "UNCHANGED"; readonly status: BetStatus };

export type TicketPayoutResult =
  | { readonly kind: "PAID"; readonly amount: number }
  | { readonly kind: "NOT_PAYABLE" };

export type TicketCancelResult =
  | { readonly kind: "CANCELLED" }
  | { readonly kind: "NOT_CANCELLABLE" };

export interface BetRepository {
  insert(bet: NewBet): Promise<{
    readonly bet: BetRecord;
    readonly ticket: TicketRecord | undefined;
  }>;
  findBet(id: string): Promise<BetRecord | undefined>;
  findByIdempotencyKey(key: string): Promise<
    | { readonly bet: BetRecord; readonly ticket: TicketRecord | undefined }
    | undefined
  >;
  listBets(filter: BetFilter): Promise<readonly BetRecord[]>;

  ticketCodeExists(code: string): Promise<boolean>;
  /** A ticket of another shop is, to this shop, no ticket at all. */
  findTicket(code: string, shopId: string): Promise<TicketRecord | undefined>;
  listTickets(filter: TicketFilter): Promise<readonly TicketRecord[]>;

  /**
   * Marks a `WON` or `VOID` ticket `PAID` and runs `moveMoney` with the amount
   * owed, in one transaction. The conditional update takes the row lock, so
   * of two concurrent attempts exactly one reaches `moveMoney`; if it throws,
   * the ticket is left payable.
   */
  payTicket(input: {
    readonly ticketId: string;
    readonly paidBy: string;
    readonly now: Date;
    readonly moveMoney: (amount: number) => Promise<void>;
  }): Promise<TicketPayoutResult>;

  /**
   * Cancels an `OPEN` ticket and its `PENDING` bet, running `moveMoney` with
   * the stake inside the same transaction, under the same guarantee.
   */
  cancelTicket(input: {
    readonly ticketId: string;
    readonly reason: string;
    readonly now: Date;
    readonly moveMoney: (stake: number) => Promise<void>;
  }): Promise<TicketCancelResult>;

  markTicketExpired(ticketId: string, now: Date): Promise<void>;

  applySettlement(input: SettlementInput): Promise<SettlementResult>;
}
