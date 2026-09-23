import { useId, useMemo, useState } from "react";
import { Pin, PinOff, Search } from "lucide-react";
import {
  MARKET_GROUP_LABEL,
  groupMarkets,
  marketTitle,
  sortMarkets,
  type MarketGroupKey,
  type MarketView,
  type SelectionView,
} from "@betng/ui-core";
import { cn } from "../lib/cn";
import { MarketsEmpty } from "./MarketsEmpty";
import { Market, type MarketDensity } from "./registry";

/*
 * Every market a match has, in one place: the Shop workspace, the Match Centre
 * markets tab and the mobile market sheet all render this. Groups, counts and
 * order come from the platform's catalogue, so a group the match has no
 * markets for is never offered as an empty tab.
 */

const ALL: MarketGroupKey | "ALL" = "ALL";

export interface MarketBoardProps {
  readonly markets: readonly MarketView[];
  readonly selectedIds: ReadonlySet<string>;
  readonly onToggle: (market: MarketView, selection: SelectionView) => void;
  readonly matchLabel?: string | undefined;
  readonly density?: MarketDensity;
  /** Offers a search field once the catalogue is too long to scan. */
  readonly searchable?: boolean;
  /** Market kinds the user pinned. A client preference; nothing is persisted here. */
  readonly pinned?: ReadonlySet<string>;
  readonly onTogglePin?: ((kind: string) => void) | undefined;
  readonly now?: number | undefined;
  readonly className?: string | undefined;
}

const SEARCHABLE_FROM = 8;

function matchesQuery(market: MarketView, query: string): boolean {
  if (query === "") return true;

  const needle = query.toLowerCase();

  return (
    marketTitle(market).toLowerCase().includes(needle) ||
    market.kind.toLowerCase().includes(needle) ||
    market.selections.some((s) => s.label.toLowerCase().includes(needle))
  );
}

export function MarketBoard({
  markets,
  selectedIds,
  onToggle,
  matchLabel,
  density = "comfortable",
  searchable = true,
  pinned,
  onTogglePin,
  now,
  className,
}: MarketBoardProps): React.JSX.Element {
  const id = useId();
  const [group, setGroup] = useState<MarketGroupKey | typeof ALL>(ALL);
  const [query, setQuery] = useState("");

  const groups = useMemo(() => groupMarkets(markets), [markets]);
  const pinnedMarkets = useMemo(
    () =>
      pinned === undefined || pinned.size === 0
        ? []
        : sortMarkets(markets.filter((m) => pinned.has(m.kind))),
    [markets, pinned],
  );

  const visible = useMemo(() => {
    const scope =
      group === ALL
        ? sortMarkets(markets)
        : (groups.find((g) => g.key === group)?.markets ?? []);

    return scope.filter((market) => matchesQuery(market, query.trim()));
  }, [markets, groups, group, query]);

  if (markets.length === 0) return <MarketsEmpty className={className} />;

  const showSearch = searchable && markets.length >= SEARCHABLE_FROM;
  const tabs: readonly { key: MarketGroupKey | typeof ALL; label: string; count: number }[] = [
    { key: ALL, label: "All", count: markets.length },
    ...groups.map((g) => ({
      key: g.key,
      label: MARKET_GROUP_LABEL[g.key],
      count: g.markets.length,
    })),
  ];

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const index = tabs.findIndex((tab) => tab.key === group);
    const target =
      event.key === "ArrowRight"
        ? tabs[(index + 1) % tabs.length]
        : event.key === "ArrowLeft"
          ? tabs[(index + tabs.length - 1) % tabs.length]
          : event.key === "Home"
            ? tabs[0]
            : event.key === "End"
              ? tabs[tabs.length - 1]
              : undefined;

    if (target === undefined) return;

    event.preventDefault();
    setGroup(target.key);
    document.getElementById(`${id}-tab-${String(target.key)}`)?.focus();
  };

  const grid =
    density === "dense"
      ? "grid gap-2 lg:grid-cols-2 2xl:grid-cols-3"
      : "grid gap-3 md:grid-cols-2";

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2 border-b border-border">
        <div
          role="tablist"
          aria-label="Market groups"
          onKeyDown={onKeyDown}
          className="flex flex-1 gap-1 overflow-x-auto scrollbar-thin"
        >
          {tabs.map((tab) => {
            const selected = tab.key === group;

            return (
              <button
                key={String(tab.key)}
                id={`${id}-tab-${String(tab.key)}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`${id}-panel`}
                tabIndex={selected ? 0 : -1}
                onClick={() => {
                  setGroup(tab.key);
                }}
                className={cn(
                  "type-small -mb-px inline-flex h-10 shrink-0 items-center gap-1.5 border-b-2 px-3 font-semibold whitespace-nowrap transition-colors duration-[var(--bn-duration-fast)] focus-ring pointer-coarse:h-11",
                  selected
                    ? "border-brand text-text-primary"
                    : "border-transparent text-text-muted hover:text-text-primary",
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    "rounded-xs px-1 text-[10px] tabular",
                    selected
                      ? "bg-brand-subtle text-brand"
                      : "bg-surface-sunken text-text-muted",
                  )}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {showSearch && (
          <div className="relative mb-1 shrink-0">
            <Search
              className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-text-muted"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
              }}
              placeholder="Search markets"
              aria-label="Search markets"
              className="type-small h-8 w-40 rounded-sm border border-border bg-surface pl-7 pr-2 text-text-primary placeholder:text-text-muted focus-ring"
            />
          </div>
        )}
      </div>

      <div id={`${id}-panel`} role="tabpanel" className="space-y-6 pt-4">
        {pinnedMarkets.length > 0 && query === "" && group === ALL && (
          <section aria-label="Pinned markets">
            <p className="caps-label mb-2">Pinned</p>
            <div className={grid}>
              {pinnedMarkets.map((market) => (
                <MarketPanel
                  key={`pinned-${market.id}`}
                  market={market}
                  selectedIds={selectedIds}
                  onToggle={onToggle}
                  matchLabel={matchLabel}
                  density={density}
                  now={now}
                  pinned
                  onTogglePin={onTogglePin}
                />
              ))}
            </div>
          </section>
        )}

        {visible.length === 0 ? (
          <p className="type-body py-6 text-center text-text-muted">
            No market matches {JSON.stringify(query.trim())}.
          </p>
        ) : (
          <div className={grid}>
            {visible.map((market) => (
              <MarketPanel
                key={market.id}
                market={market}
                selectedIds={selectedIds}
                onToggle={onToggle}
                matchLabel={matchLabel}
                density={density}
                now={now}
                pinned={pinned?.has(market.kind) ?? false}
                onTogglePin={onTogglePin}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface MarketPanelProps {
  readonly market: MarketView;
  readonly selectedIds: ReadonlySet<string>;
  readonly onToggle: (market: MarketView, selection: SelectionView) => void;
  readonly matchLabel: string | undefined;
  readonly density: MarketDensity;
  readonly now: number | undefined;
  readonly pinned: boolean;
  readonly onTogglePin: ((kind: string) => void) | undefined;
}

function MarketPanel({
  market,
  selectedIds,
  onToggle,
  matchLabel,
  density,
  now,
  pinned,
  onTogglePin,
}: MarketPanelProps): React.JSX.Element {
  const wide = market.columns >= 4 || market.selections.length > 8;

  return (
    <div className={cn("relative min-w-0", wide && "md:col-span-2")}>
      <Market
        market={market}
        selectedIds={selectedIds}
        onToggle={onToggle}
        matchLabel={matchLabel}
        density={density}
        now={now}
      />
      {onTogglePin !== undefined && (
        <button
          type="button"
          aria-pressed={pinned}
          aria-label={`${pinned ? "Unpin" : "Pin"} ${marketTitle(market)}`}
          onClick={() => {
            onTogglePin(market.kind);
          }}
          className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary focus-ring"
        >
          {pinned ? (
            <PinOff className="size-3.5" aria-hidden />
          ) : (
            <Pin className="size-3.5" aria-hidden />
          )}
        </button>
      )}
    </div>
  );
}
