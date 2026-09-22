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

export interface WindowUsage {
  readonly used: bigint;
  /** The oldest counted row: usage starts to fall when it leaves the window. */
  readonly oldestAt: Date | undefined;
}

export interface LossUsage extends WindowUsage {
  /** Stakes of bets placed in the window that have not settled: counted as potential loss. */
  readonly openStakes: bigint;
}

export interface DeletionBlockers {
  readonly balance: bigint;
  readonly openPayments: number;
  readonly openBets: number;
}

export interface ReadModelRepository {
  depositUsage(customerId: string, since: Date): Promise<WindowUsage>;
  lossUsage(customerId: string, since: Date): Promise<LossUsage>;
  deletionBlockers(customerId: string): Promise<DeletionBlockers>;
  customerFigures(customerIds: readonly string[]): Promise<ReadonlyMap<string, CustomerFigures>>;
  shopFigures(shopIds: readonly string[]): Promise<ReadonlyMap<string, ShopFigures>>;
  cashierFigures(cashierIds: readonly string[]): Promise<ReadonlyMap<string, CashierFigures>>;
  shopBalance(shopId: string): Promise<number>;
}
