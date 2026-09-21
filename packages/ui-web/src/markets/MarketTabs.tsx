import { useId, useState } from "react";
import type { MarketGroupKey, MarketView } from "@betng/ui-core";
import { cn } from "../lib/cn";
import { MarketsEmpty } from "./MarketsEmpty";
import { groupMarkets } from "./marketStatus";

export interface MarketTabsProps {
  readonly markets: readonly MarketView[];
  /** Renders the markets of the active group. */
  readonly children: (
    markets: readonly MarketView[],
    group: MarketGroupKey,
  ) => React.ReactNode;
  readonly value?: MarketGroupKey | undefined;
  readonly onChange?: ((group: MarketGroupKey) => void) | undefined;
  readonly label?: string;
  readonly className?: string | undefined;
}

export function MarketTabs({
  markets,
  children,
  value,
  onChange,
  label = "Market groups",
  className,
}: MarketTabsProps): React.JSX.Element {
  const id = useId();
  const groups = groupMarkets(markets);
  const [internal, setInternal] = useState<MarketGroupKey | undefined>(
    undefined,
  );
  const wanted = value ?? internal;
  const active = groups.find((g) => g.key === wanted) ?? groups[0];

  if (active === undefined) return <MarketsEmpty className={className} />;

  const select = (key: MarketGroupKey): void => {
    setInternal(key);
    onChange?.(key);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const index = groups.findIndex((g) => g.key === active.key);
    const target =
      event.key === "ArrowRight"
        ? groups[(index + 1) % groups.length]
        : event.key === "ArrowLeft"
          ? groups[(index + groups.length - 1) % groups.length]
          : event.key === "Home"
            ? groups[0]
            : event.key === "End"
              ? groups[groups.length - 1]
              : undefined;

    if (target === undefined) return;

    event.preventDefault();
    select(target.key);
    document.getElementById(`${id}-tab-${target.key}`)?.focus();
  };

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="flex gap-1 overflow-x-auto border-b border-border scrollbar-thin"
      >
        {groups.map((group) => {
          const selected = group.key === active.key;

          return (
            <button
              key={group.key}
              id={`${id}-tab-${group.key}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${id}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => {
                select(group.key);
              }}
              className={cn(
                "type-small -mb-px inline-flex h-10 shrink-0 items-center gap-1.5 border-b-2 px-3 font-semibold whitespace-nowrap transition-colors duration-[var(--bn-duration-fast)] focus-ring pointer-coarse:h-11",
                selected
                  ? "border-brand text-text-primary"
                  : "border-transparent text-text-muted hover:text-text-primary",
              )}
            >
              {group.label}
              <span
                className={cn(
                  "rounded-xs px-1 text-[10px] tabular",
                  selected
                    ? "bg-brand-subtle text-brand"
                    : "bg-surface-sunken text-text-muted",
                )}
              >
                {group.markets.length}
              </span>
            </button>
          );
        })}
      </div>
      <div
        id={`${id}-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-tab-${active.key}`}
        className="pt-4"
      >
        {children(active.markets, active.key)}
      </div>
    </div>
  );
}
