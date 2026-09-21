export interface LegSnapshot {
  readonly selectionId: string;
  readonly marketId: string;
  readonly marketMatchId: string;
  readonly selectionMatchId: string;
  readonly selectionCode: string;
  readonly selectionLabel: string;
  readonly odds: string;
  readonly marketType: string;
  readonly line: string | null;
  readonly marketStatus: string;
  readonly oddsVersion: number;
  readonly lifecycle: string;
  readonly kickoffAt: Date;
  readonly bettingClosesAt: Date;
  readonly leagueId: string;
  readonly leagueName: string;
  readonly homeName: string;
  readonly awayName: string;
}

export interface MatchWindow {
  readonly matchId: string;
  readonly lifecycle: string;
  readonly bettingClosesAt: Date;
}

export interface CounterStaff {
  readonly shopCode: string;
  readonly shopStatus: string;
  readonly cashierName: string;
  readonly cashierStatus: string;
}

export interface MarketReader {
  loadLegs(selectionIds: readonly string[]): Promise<readonly LegSnapshot[]>;
  loadMatchWindows(matchIds: readonly string[]): Promise<readonly MatchWindow[]>;
  loadCounterStaff(
    cashierId: string,
    shopId: string,
  ): Promise<CounterStaff | undefined>;
}
