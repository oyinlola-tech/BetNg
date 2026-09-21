import { Fragment, memo } from "react";
import { Lock, Minus, Plus } from "lucide-react";
import type { MarketKind, MarketView, MatchMarketsView, MatchSummary, SelectionView } from "@betng/ui-core";
import { formatOdds } from "@betng/ui-core";
import { MarketCard, TeamBadge, cn } from "@betng/ui-web";

export interface GridColumn {
  readonly key: string;
  readonly header: string;
  readonly kind: MarketKind;
  readonly line?: number;
  readonly selectionCode: string;
}

export interface GridGroup {
  readonly key: string;
  readonly title: string;
  readonly columns: readonly GridColumn[];
}

export function findSelection(markets: MatchMarketsView | undefined, column: Pick<GridColumn, "kind" | "line" | "selectionCode">): { readonly market: MarketView; readonly selection: SelectionView } | undefined {
  const market = markets?.markets.find((m) => m.kind === column.kind && (column.line === undefined || m.line === column.line));
  const selection = market?.selections.find((s) => s.code === column.selectionCode);

  return market === undefined || selection === undefined ? undefined : { market, selection };
}

interface WeekGridProps {
  readonly matches: readonly MatchSummary[];
  readonly marketsById: ReadonlyMap<string, MatchMarketsView>;
  readonly groups: readonly GridGroup[];
  readonly bettable: boolean;
  readonly expandedId: string | undefined;
  readonly onExpand: (matchId: string) => void;
  readonly isSelected: (selectionId: string) => boolean;
  readonly onToggle: (match: MatchSummary, market: MarketView, selection: SelectionView) => void;
}

const WIDE: ReadonlySet<MarketKind> = new Set(["DOUBLE_CHANCE", "GOAL_SPREAD", "CORRECT_SCORE"]);

const OddsCell = memo(function OddsCell({ odds, label, selected, disabled, onClick }: { readonly odds: number; readonly label: string; readonly selected: boolean; readonly disabled: boolean; readonly onClick: () => void }): React.JSX.Element {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-9 w-full min-w-12 rounded-sm font-display text-md font-semibold tabular transition-colors duration-[var(--bn-duration-fast)] focus-ring pointer-coarse:h-11",
        selected ? "bg-brand text-text-on-brand" : "bg-surface-sunken text-text-primary hover:bg-brand-subtle hover:text-brand",
        disabled && "cursor-not-allowed opacity-45 hover:bg-surface-sunken hover:text-text-primary",
      )}
    >
      {formatOdds(odds)}
    </button>
  );
});

export function WeekGrid({ matches, marketsById, groups, bettable, expandedId, onExpand, isSelected, onToggle }: WeekGridProps): React.JSX.Element {
  const columnCount = groups.reduce((sum, g) => sum + g.columns.length, 0);

  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full border-separate border-spacing-0 text-left">
        <caption className="sr-only">Odds for every event this week</caption>
        <thead className="sticky top-0 z-sticky">
          <tr className="bg-background">
            <th scope="col" rowSpan={2} className="sticky left-0 z-sticky w-56 border-b border-border bg-background px-3 text-left align-bottom">
              <span className="caps-label block pb-1.5">Events</span>
            </th>
            {groups.map((group, index) => (
              <th key={group.key} scope="colgroup" colSpan={group.columns.length} className={cn("px-1 pt-2 text-center", index > 0 && "pl-4")}>
                <span className="caps-label">{group.title}</span>
              </th>
            ))}
          </tr>
          <tr className="bg-background">
            {groups.map((group, index) =>
              group.columns.map((column, i) => (
                <th key={column.key} scope="col" className={cn("border-b border-border px-1 pb-1.5 pt-0.5 text-center text-sm font-bold text-text-secondary", index > 0 && i === 0 && "pl-4")}>
                  {column.header}
                </th>
              )),
            )}
          </tr>
        </thead>
        <tbody>
          {matches.map((match, row) => {
            const markets = marketsById.get(match.id);
            const expanded = expandedId === match.id;
            const label = `${match.home.name} v ${match.away.name}`;
            const zebra = row % 2 === 1 ? "bg-surface-hover" : "bg-surface";

            return (
              <Fragment key={match.id}>
                <tr className={zebra}>
                  <th scope="row" className={cn("sticky left-0 z-[1] border-b border-border px-3 py-1 text-left font-normal", zebra)}>
                    <div className="flex items-center gap-2">
                      <span className="w-5 shrink-0 text-right font-display text-md font-bold tabular text-text-muted">{row + 1}</span>
                      <TeamBadge team={match.home} size="xs" />
                      <span className="min-w-0 flex-1 truncate text-base font-semibold text-text-primary" title={label}>
                        {match.home.code}
                        <span className="px-1 font-normal text-text-muted">-</span>
                        {match.away.code}
                      </span>
                      <TeamBadge team={match.away} size="xs" />
                      <button
                        type="button"
                        aria-expanded={expanded}
                        aria-label={`${expanded ? "Hide" : "Show"} all markets, event ${String(row + 1)}, ${label}`}
                        disabled={!bettable || markets === undefined}
                        onClick={() => {
                          onExpand(match.id);
                        }}
                        className="flex size-7 shrink-0 items-center justify-center rounded-sm border border-border text-text-secondary transition-colors hover:bg-surface-sunken focus-ring disabled:opacity-40 pointer-coarse:size-10"
                      >
                        {expanded ? <Minus className="size-3.5" /> : <Plus className="size-3.5" />}
                      </button>
                    </div>
                  </th>
                  {groups.map((group, index) =>
                    group.columns.map((column, i) => {
                      const found = findSelection(markets, column);

                      return (
                        <td key={column.key} className={cn("border-b border-border px-0.5 py-1", index > 0 && i === 0 && "pl-4")}>
                          {found === undefined ? (
                            <span className="flex h-9 items-center justify-center rounded-sm bg-surface-sunken text-text-muted pointer-coarse:h-11" aria-label="Not available">
                              {markets === undefined ? <span className="skeleton h-3 w-8" /> : <Lock className="size-3" aria-hidden />}
                            </span>
                          ) : (
                            <OddsCell
                              odds={found.selection.odds}
                              label={`Event ${String(row + 1)}, ${label}, ${found.market.name}, ${found.selection.label}, ${formatOdds(found.selection.odds)}`}
                              selected={isSelected(found.selection.id)}
                              disabled={!bettable || found.market.status !== "OPEN"}
                              onClick={() => {
                                onToggle(match, found.market, found.selection);
                              }}
                            />
                          )}
                        </td>
                      );
                    }),
                  )}
                </tr>
                {expanded && bettable && markets !== undefined && (
                  <tr className="bg-surface-sunken/50">
                    <td colSpan={columnCount + 1} className="border-b border-border px-3 py-3">
                      <p className="mb-2 text-sm font-semibold text-text-secondary">
                        Event {row + 1} · {label} · all markets
                      </p>
                      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                        {markets.markets.map((market) => (
                          <MarketCard
                            key={market.id}
                            market={market}
                            isSelected={isSelected}
                            onToggle={(m, s) => {
                              onToggle(match, m, s);
                            }}
                            className={WIDE.has(market.kind) ? "md:col-span-2 xl:col-span-3" : undefined}
                          />
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
