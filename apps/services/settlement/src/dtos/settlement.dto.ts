import { asId, CURRENCY } from "@betng/contracts";
import type {
  AdminSettlement,
  CommissionConfig,
  CommissionSummary,
  OperatorPeriod,
  OperatorSummary,
  Settlement,
} from "@betng/contracts";
import type {
  AdminSettlementRecord,
  CommissionConfigRecord,
  CommissionLedgerRecord,
  OperatorPeriodRecord,
  OperatorSummaryRecord,
  SettlementRecord,
} from "../models/index.js";
import { basisPointsToPercent, percentToBasisPoints, toSafeNumber } from "../utils/index.js";

export interface SettlementListDto {
  readonly items: readonly Settlement[];
}

export interface AdminSettlementListDto {
  readonly items: readonly AdminSettlement[];
}

export interface OperatorOverviewDto {
  readonly current: OperatorSummary;
  readonly closed: readonly OperatorSummary[];
}

export interface OperatorPeriodListDto {
  readonly items: readonly OperatorPeriod[];
}

export interface ClosePeriodDto {
  readonly closed: OperatorSummary;
  readonly current: OperatorSummary;
}

export interface CommissionListDto {
  readonly items: readonly CommissionSummary[];
}

export interface CommissionConfigDto {
  readonly default: CommissionConfig;
  readonly shops: readonly CommissionConfig[];
}

function percent(text: string): number {
  return basisPointsToPercent(percentToBasisPoints(text));
}

export function toSettlementDto(record: SettlementRecord): Settlement {
  return {
    id: asId<"SettlementId">(record.id),
    betId: asId<"BetId">(record.betId),
    outcome: record.outcome,
    selections: record.legs.map((leg) => ({
      selectionId: asId<"SelectionId">(leg.selectionId),
      matchId: asId<"MatchId">(leg.matchId),
      outcome: leg.outcome,
    })),
    payout: toSafeNumber(record.payout),
    currency: CURRENCY,
    settledAt: record.settledAt.toISOString(),
  };
}

export function toAdminSettlementDto(record: AdminSettlementRecord): AdminSettlement {
  const ownerKind = record.channel === "SHOP" ? "shop" : "user";

  return {
    id: record.betId,
    betId: record.betId,
    ...(record.ticketCode === null ? {} : { ticketCode: record.ticketCode }),
    owner: `${ownerKind}:${record.ownerName ?? record.ownerId ?? "unknown"}`,
    channel: record.channel,
    matchLabel: record.matchLabel,
    result: record.result,
    stake: toSafeNumber(record.stake),
    payout: toSafeNumber(record.payout),
    status: record.status,
    ...(record.error === null ? {} : { error: record.error }),
    timestamp: record.timestamp.toISOString(),
  };
}

export function toOperatorPeriodDto(record: OperatorPeriodRecord): OperatorPeriod {
  return {
    id: record.id,
    kind: record.kind,
    status: record.status,
    startsAt: record.startsAt.toISOString(),
    ...(record.endsAt === null ? {} : { endsAt: record.endsAt.toISOString() }),
  };
}

export function toOperatorSummaryDto(record: OperatorSummaryRecord): OperatorSummary {
  return {
    period: toOperatorPeriodDto(record.period),
    grossStakes: toSafeNumber(record.grossStakes),
    grossPayouts: toSafeNumber(record.grossPayouts),
    operatorResult: toSafeNumber(record.operatorResult),
    operatorResultRate: Number(record.operatorResultRate),
    settledBets: record.settledBets,
    voidBets: record.voidBets,
    refundedStakes: toSafeNumber(record.refundedStakes),
  };
}

export function toCommissionSummaryDto(
  record: CommissionLedgerRecord,
  shopName: string | undefined,
): CommissionSummary {
  return {
    periodId: record.periodId,
    shopId: record.shopId,
    ...(shopName === undefined ? {} : { shopName }),
    grossStakes: toSafeNumber(record.grossStakes),
    grossPayouts: toSafeNumber(record.grossPayouts),
    grossOperatorResult: toSafeNumber(record.grossOperatorResult),
    shopSharePercent: percent(record.shopSharePercent),
    shopShareAmount: toSafeNumber(record.shopShareAmount),
    platformSharePercent: percent(record.platformSharePercent),
    platformShareAmount: toSafeNumber(record.platformShareAmount),
    createdAt: record.createdAt.toISOString(),
  };
}

export function toCommissionConfigDto(record: CommissionConfigRecord): CommissionConfig {
  return {
    ...(record.shopId === null ? {} : { shopId: record.shopId }),
    shopSharePercent: percent(record.shopSharePercent),
    effectiveFrom: record.effectiveFrom.toISOString(),
    updatedBy: record.createdBy,
  };
}
