import type { MarketKind, MatchMarketsView, MatchSummary, SelectionView } from "@betng/ui-core";

export type Movement = "UP" | "DOWN" | "STEADY" | "NEW";

export const BIG_MOVE = 0.1;

export function impliedProbability(odds: number): number | undefined {
  return Number.isFinite(odds) && odds > 1 ? 1 / odds : undefined;
}

export function formatImplied(odds: number): string {
  const p = impliedProbability(odds);

  return p === undefined ? "–" : `${(p * 100).toFixed(1)}%`;
}

export interface OddsSnapshot {
  readonly version: string;
  readonly odds: ReadonlyMap<string, number>;
}

export interface TickerState {
  readonly shown: OddsSnapshot | undefined;
  readonly previous: OddsSnapshot | undefined;
}

export const EMPTY_TICKER: TickerState = { shown: undefined, previous: undefined };

function selectionKey(matchId: string, s: SelectionView): string {
  return `${matchId}:${s.id}`;
}

export function snapshotOf(markets: readonly MatchMarketsView[]): OddsSnapshot {
  const odds = new Map<string, number>();

  for (const view of markets) for (const market of view.markets) for (const s of market.selections) odds.set(selectionKey(view.matchId, s), s.odds);

  const version = [...markets].map((m) => `${m.matchId}@${m.generatedAt}`).sort().join("|");

  return { version, odds };
}

function sameOdds(a: OddsSnapshot, b: OddsSnapshot): boolean {
  if (a.odds.size !== b.odds.size) return false;
  for (const [key, value] of a.odds) if (b.odds.get(key) !== value) return false;

  return true;
}

/* A repeated read of the same platform snapshot is not a new snapshot; movement is always against the one shown before. */
export function advanceTicker(state: TickerState, next: OddsSnapshot): TickerState {
  if (state.shown !== undefined && (state.shown.version === next.version || sameOdds(state.shown, next))) return state;

  return { previous: state.shown, shown: next };
}

export function movementOf(current: number, previous: number | undefined): { readonly movement: Movement; readonly change: number | undefined; readonly big: boolean } {
  if (previous === undefined) return { movement: "NEW", change: undefined, big: false };
  if (current === previous) return { movement: "STEADY", change: 0, big: false };

  const change = (current - previous) / previous;

  return { movement: change > 0 ? "UP" : "DOWN", change, big: Math.abs(change) > BIG_MOVE };
}

export interface Quote {
  readonly key: string;
  readonly label: string;
  readonly odds: number;
  readonly implied: string;
  readonly movement: Movement;
  readonly change: number | undefined;
  readonly big: boolean;
}

export interface TickerEntry {
  readonly matchId: string;
  readonly title: string;
  readonly league: string;
  readonly quotes: readonly Quote[];
}

const RESULT_LABELS: Readonly<Record<string, string>> = { HOME: "1", DRAW: "X", AWAY: "2" };

export function quotesFor(view: MatchMarketsView | undefined, kind: MarketKind, previous: OddsSnapshot | undefined, line?: number): readonly Quote[] {
  const market = view?.markets.find((m) => m.kind === kind && m.status === "OPEN" && (line === undefined || m.line === line));

  if (view === undefined || market === undefined) return [];

  return market.selections
    .filter((s) => s.status === undefined || s.status === "OPEN")
    .map((s) => {
      const key = selectionKey(view.matchId, s);
      const move = movementOf(s.odds, previous?.odds.get(key));

      return { key, label: kind === "MATCH_RESULT" ? (RESULT_LABELS[s.code] ?? s.shortLabel) : s.shortLabel, odds: s.odds, implied: formatImplied(s.odds), ...move };
    });
}

export function tickerEntries(matches: readonly MatchSummary[], markets: ReadonlyMap<string, MatchMarketsView>, previous: OddsSnapshot | undefined): readonly TickerEntry[] {
  return matches
    .filter((m) => m.phase === "BETTING_OPEN")
    .flatMap((m) => {
      const quotes = quotesFor(markets.get(m.id), "MATCH_RESULT", previous);

      return quotes.length === 0 ? [] : [{ matchId: m.id, title: `${m.home.code} v ${m.away.code}`, league: m.leagueCode, quotes }];
    });
}
