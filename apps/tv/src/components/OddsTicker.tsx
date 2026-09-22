import { useMemo, useRef } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { MatchId } from "@betng/contracts";
import { formatOdds, type MatchMarketsView } from "@betng/ui-core";
import { useAsync } from "../hooks/useAsync";
import { useNow } from "../hooks/useNow";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { cn } from "../lib/cn";
import { advanceTicker, EMPTY_TICKER, snapshotOf, tickerEntries, type Quote, type TickerEntry } from "../lib/odds";
import { reads } from "../lib/reads";

const PAGE_SIZE = 3;
const PAGE_MS = 10_000;

export function MovementMark({ quote }: { readonly quote: Quote }): React.JSX.Element | null {
  if (quote.movement !== "UP" && quote.movement !== "DOWN") return null;

  const pct = `${(Math.abs(quote.change ?? 0) * 100).toFixed(0)}%`;
  const Icon = quote.movement === "UP" ? ArrowUp : ArrowDown;

  return (
    <span data-movement={quote.movement} data-big={quote.big ? "true" : "false"} className={cn("inline-flex items-center gap-[0.15rem] font-bold", quote.big && "rounded-xs bg-warning px-[0.3rem] text-text-on-status")}>
      <Icon className="size-[0.95em]" aria-hidden />
      <span className={quote.big ? "" : "sr-only"}>
        {quote.movement === "UP" ? "up" : "down"} {pct}
      </span>
    </span>
  );
}

function Entry({ entry }: { readonly entry: TickerEntry }): React.JSX.Element {
  return (
    <span className="inline-flex shrink-0 items-center gap-[0.9rem] whitespace-nowrap pr-[2.4rem]">
      <span className="text-[0.8rem] font-bold uppercase tracking-caps text-text-muted">{entry.league}</span>
      <span className="font-display text-[1.05rem] font-black">{entry.title}</span>
      {entry.quotes.map((q) => (
        <span key={q.key} data-quote={q.key} className="inline-flex items-center gap-[0.35rem] text-[1rem]">
          <span className="font-bold text-text-muted">{q.label}</span>
          <span className="font-display font-black tabular">{formatOdds(q.odds)}</span>
          <MovementMark quote={q} />
          <span className="text-[0.8rem] text-text-muted">implied {q.implied}</span>
        </span>
      ))}
    </span>
  );
}

/* Read-only: the platform's current prices for matches with betting open. Nothing here can be selected. */
export function OddsTicker({ className }: { readonly className?: string }): React.JSX.Element | null {
  const reduced = useReducedMotion();
  const now = useNow(PAGE_MS);
  const upcoming = useAsync(() => reads.listMatches({ phases: ["BETTING_OPEN"], limit: 12 }), [], 10_000);
  const ids = (upcoming.data ?? []).map((m) => m.id).join(",");
  const markets = useAsync(
    async () => {
      const list = await Promise.all(
        ids
          .split(",")
          .filter((id) => id !== "")
          .map((id) => reads.getMatchMarkets(id as MatchId).catch(() => undefined)),
      );

      return list.filter((v): v is MatchMarketsView => v !== undefined);
    },
    [ids],
    15_000,
  );
  const state = useRef(EMPTY_TICKER);
  const snapshot = useMemo(() => (markets.data === undefined ? undefined : snapshotOf(markets.data)), [markets.data]);

  if (snapshot !== undefined) state.current = advanceTicker(state.current, snapshot);

  const byMatch = new Map((markets.data ?? []).map((v) => [v.matchId as string, v]));
  const entries = tickerEntries(upcoming.data ?? [], byMatch, state.current.previous);

  if (entries.length === 0) return null;

  const pages = Math.ceil(entries.length / PAGE_SIZE);
  const page = Math.floor(now / PAGE_MS) % pages;
  const shown = reduced ? entries.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE) : entries;

  return (
    <section aria-label="Current prices, display only" data-motion={reduced ? "reduced" : "full"} className={cn("flex h-[2.6rem] items-stretch overflow-hidden border border-border bg-surface", className)}>
      <p className="flex shrink-0 items-center border-r border-border bg-surface-sunken px-[1rem] text-[0.78rem] font-bold uppercase tracking-caps text-text-secondary">Prices · display only</p>
      <div className="relative min-w-0 flex-1 overflow-hidden">
        <div className={cn("absolute inset-y-0 left-0 flex items-center pl-[1.2rem]", !reduced && "ticker-track w-max")} style={reduced ? undefined : ({ "--tv-ticker-duration": `${String(Math.max(30, entries.length * 9))}s` } as React.CSSProperties)}>
          {shown.map((e) => (
            <Entry key={e.matchId} entry={e} />
          ))}
          {!reduced && (
            <span aria-hidden className="inline-flex">
              {entries.map((e) => (
                <Entry key={`dup-${e.matchId}`} entry={e} />
              ))}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
