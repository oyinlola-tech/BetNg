export const SETTLEMENT_QUERY = Object.freeze({
  GET_SETTLEMENT: "settlement.getSettlement",
  LIST_SETTLEMENTS: "settlement.listSettlements",
});

export type SettlementQueryType =
  (typeof SETTLEMENT_QUERY)[keyof typeof SETTLEMENT_QUERY];
