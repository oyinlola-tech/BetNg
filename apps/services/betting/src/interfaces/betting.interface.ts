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
  // As stored; EXPIRED is also derived from expiresAt on read.
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
  findTicket(code: string, shopId: string): Promise<TicketRecord | undefined>;
  listTickets(filter: TicketFilter): Promise<readonly TicketRecord[]>;

  // One transaction: conditional update to PAID (takes the row lock), then `moveMoney`. Of two concurrent calls
  // exactly one reaches `moveMoney`; if it throws, the ticket stays payable.
  payTicket(input: {
    readonly ticketId: string;
    readonly paidBy: string;
    readonly now: Date;
    readonly moveMoney: (amount: number) => Promise<void>;
  }): Promise<TicketPayoutResult>;

  // Same guarantee: bet and ticket become CANCELLED only if `moveMoney` succeeds.
  cancelTicket(input: {
    readonly ticketId: string;
    readonly reason: string;
    readonly now: Date;
    readonly moveMoney: (stake: number) => Promise<void>;
  }): Promise<TicketCancelResult>;

  markTicketExpired(ticketId: string, now: Date): Promise<void>;

  applySettlement(input: SettlementInput): Promise<SettlementResult>;
}
