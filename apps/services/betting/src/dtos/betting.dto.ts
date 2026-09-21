/**
 * Maps the stored records onto the wire contracts.
 *
 * Odds leave as decimal numbers because the contract says so; they are
 * produced from integer hundredths here, at the edge, and never computed with.
 */

import { asId, CURRENCY } from "@betng/contracts";
import type {
  Bet,
  BetSelection,
  Ticket,
  TicketSelection,
  TicketStatus,
} from "@betng/contracts";
import type {
  BetLegRecord,
  BetRecord,
  TicketRecord,
} from "../interfaces/index.js";

export interface BetListDto {
  readonly items: readonly Bet[];
}

export interface TicketListDto {
  readonly items: readonly Ticket[];
}

function toSelectionDto(leg: BetLegRecord): BetSelection {
  return {
    matchId: asId<"MatchId">(leg.matchId),
    marketId: asId<"MarketId">(leg.marketId),
    selectionId: asId<"SelectionId">(leg.selectionId),
    odds: leg.oddsHundredths / 100,
    oddsVersion: leg.oddsVersion,
    selectionCode: leg.selectionCode,
    ...(leg.lineTenths === undefined ? {} : { line: leg.lineTenths / 10 }),
    matchLabel: leg.matchLabel,
    leagueName: leg.leagueName,
    kickoffAt: leg.kickoffAt.toISOString(),
    ...(leg.result === undefined ? {} : { result: leg.result }),
    marketType: leg.marketType,
    marketLabel: leg.marketLabel,
    selectionLabel: leg.selectionLabel,
    outcome: leg.outcome,
  };
}

/** Only an online bet has the bettor the `Bet` contract requires. */
export function toBetDto(record: BetRecord): Bet {
  if (record.userId === undefined) {
    throw new Error(`Bet ${record.id} has no customer; it is a shop ticket.`);
  }

  return {
    id: asId<"BetId">(record.id),
    userId: asId<"UserId">(record.userId),
    selections: record.legs.map(toSelectionDto),
    stake: record.stake,
    currency: CURRENCY,
    totalOdds: record.totalOddsHundredths / 100,
    potentialPayout: record.potentialPayout,
    status: record.status,
    placedAt: record.placedAt.toISOString(),
    ...(record.settledAt === undefined
      ? {}
      : { settledAt: record.settledAt.toISOString() }),
    ...(record.payout === undefined ? {} : { payout: record.payout }),
    channel: record.channel,
  };
}

/** A won or void ticket nobody collected in time reads as `EXPIRED`. */
export function effectiveTicketStatus(
  record: TicketRecord,
  now: Date,
): TicketStatus {
  return (record.status === "WON" || record.status === "VOID") &&
    record.expiresAt.getTime() <= now.getTime()
    ? "EXPIRED"
    : record.status;
}

function toTicketSelectionDto(leg: BetLegRecord): TicketSelection {
  return {
    matchId: asId<"MatchId">(leg.matchId),
    marketId: asId<"MarketId">(leg.marketId),
    selectionId: asId<"SelectionId">(leg.selectionId),
    odds: leg.oddsHundredths / 100,
    marketType: leg.marketType,
    marketLabel: leg.marketLabel,
    selectionLabel: leg.selectionLabel,
    matchLabel: leg.matchLabel,
    leagueName: leg.leagueName,
    kickoffAt: leg.kickoffAt.toISOString(),
    outcome: leg.outcome,
    ...(leg.result === undefined ? {} : { result: leg.result }),
  };
}

export function toTicketDto(record: TicketRecord, now: Date): Ticket {
  const { bet } = record;

  return {
    id: asId<"TicketId">(record.id),
    code: record.code,
    shopId: asId<"ShopId">(record.shopId),
    shopCode: record.shopCode,
    cashierId: asId<"CashierId">(record.cashierId),
    cashierName: record.cashierName,
    ...(record.customerName === undefined
      ? {}
      : { customerName: record.customerName }),
    ...(record.customerPhone === undefined
      ? {}
      : { customerPhone: record.customerPhone }),
    selections: bet.legs.map(toTicketSelectionDto),
    stake: bet.stake,
    totalOdds: bet.totalOddsHundredths / 100,
    potentialPayout: bet.potentialPayout,
    status: effectiveTicketStatus(record, now),
    ...(bet.payout === undefined ? {} : { payout: bet.payout }),
    placedAt: bet.placedAt.toISOString(),
    ...(bet.settledAt === undefined
      ? {}
      : { settledAt: bet.settledAt.toISOString() }),
    ...(record.paidAt === undefined
      ? {}
      : { paidAt: record.paidAt.toISOString() }),
    expiresAt: record.expiresAt.toISOString(),
  };
}
