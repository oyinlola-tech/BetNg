export interface CustomerFigures {
  readonly balance: number;
  readonly openBets: number;
  readonly lifetimeStake: number;
  readonly lifetimePayout: number;
}

export interface ShopFigures {
  readonly balance: number;
  readonly todaySales: number;
  readonly todayPayouts: number;
  readonly openTickets: number;
}

export interface CashierFigures {
  readonly todayTransactions: number;
  readonly todaySales: number;
}

export interface ReadModelRepository {
  customerFigures(customerIds: readonly string[]): Promise<ReadonlyMap<string, CustomerFigures>>;
  shopFigures(shopIds: readonly string[]): Promise<ReadonlyMap<string, ShopFigures>>;
  cashierFigures(cashierIds: readonly string[]): Promise<ReadonlyMap<string, CashierFigures>>;
  shopBalance(shopId: string): Promise<number>;
}
