/**
 * Read-only views of other services' tables (§8 of the architecture).
 *
 * Placement prices a slip from these rows, never from what the client sent.
 * They are reads only: this login cannot write outside the `betting` schema.
 */

export interface LegSnapshot {
  readonly selectionId: string;
  readonly marketId: string;
  /** The match the market belongs to, and the one the selection claims. */
  readonly marketMatchId: string;
  readonly selectionMatchId: string;
  readonly selectionCode: string;
  readonly selectionLabel: string;
  /** `numeric(8,2)` as text: parsed to integer hundredths, never to a float. */
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
  /** The cashier, only if they belong to that shop. */
  loadCounterStaff(
    cashierId: string,
    shopId: string,
  ): Promise<CounterStaff | undefined>;
}
