import { useId, useMemo } from "react";
import type { SelectionView } from "@betng/ui-core";
import { cn } from "../lib/cn";
import { MarketStatusTag } from "./MarketStatusTag";
import { MarketSuspendedState } from "./MarketSuspendedState";
import { SelectionButton } from "./SelectionButton";
import { marketTitle } from "./marketStatus";
import type { MarketRendererProps } from "./registry";

/*
 * A correct-score market is a scoreline, not a list: a cashier reads "2 – 1"
 * fastest when the home win, the draw and the away win are already apart. The
 * three columns come from the selection labels the platform sent, so a market
 * whose labels this cannot parse falls back to one plain grid rather than
 * guessing at a scoreline.
 */

const SCORELINE = /^(\d+)\s*[-–]\s*(\d+)$/;

type Column = "HOME" | "DRAW" | "AWAY" | "OTHER";

const COLUMN_LABEL: Readonly<Record<Column, string>> = {
  HOME: "Home win",
  DRAW: "Draw",
  AWAY: "Away win",
  OTHER: "Other",
};

const COLUMN_ORDER: readonly Column[] = ["HOME", "DRAW", "AWAY", "OTHER"];

interface Cell {
  readonly selection: SelectionView;
  readonly column: Column;
  readonly home: number;
  readonly away: number;
}

function toCell(selection: SelectionView): Cell {
  const match = SCORELINE.exec(selection.label.trim());

  if (match === null) {
    return { selection, column: "OTHER", home: -1, away: -1 };
  }

  const home = Number(match[1]);
  const away = Number(match[2]);

  return {
    selection,
    column: home > away ? "HOME" : home === away ? "DRAW" : "AWAY",
    home,
    away,
  };
}

export function CorrectScoreMarket({
  market,
  selectedIds,
  onToggle,
  matchLabel,
  density = "comfortable",
  flush = false,
  className,
}: MarketRendererProps): React.JSX.Element {
  const headingId = useId();
  const columns = useMemo(() => {
    const cells = market.selections.map(toCell);
    const parsed = cells.filter((cell) => cell.column !== "OTHER");

    // Nothing parsed as a scoreline: this is not the market this layout assumes.
    if (parsed.length === 0) return undefined;

    return COLUMN_ORDER.flatMap((column) => {
      const members = cells
        .filter((cell) => cell.column === column)
        .sort((a, b) => a.home - b.home || a.away - b.away);

      return members.length === 0
        ? []
        : [{ key: column, label: COLUMN_LABEL[column], cells: members }];
    });
  }, [market.selections]);

  const size = density === "comfortable" ? "md" : "sm";
  const suspended = market.status === "SUSPENDED";

  return (
    <section
      aria-labelledby={headingId}
      data-status={market.status}
      className={cn(
        !flush && "rounded-md border border-border bg-surface",
        className,
      )}
    >
      <header
        className={cn(
          "flex items-center justify-between gap-2 border-b border-border py-2.5",
          !flush && "px-4",
        )}
      >
        <h3 id={headingId} className="type-h3 min-w-0 truncate text-base">
          {marketTitle(market)}
        </h3>
        {market.status !== "OPEN" && (
          <MarketStatusTag status={market.status} />
        )}
      </header>

      <div className={cn("space-y-2 py-3", !flush && "px-3")}>
        {suspended && (
          <MarketSuspendedState reason={market.suspensionReason} />
        )}
        {columns === undefined ? (
          <div
            role="group"
            aria-labelledby={headingId}
            className="grid grid-cols-3 gap-1.5"
          >
            {market.selections.map((selection) => (
              <SelectionButton
                key={selection.id}
                selection={selection}
                market={market}
                size={size}
                selected={selectedIds.has(selection.id)}
                matchLabel={matchLabel}
                onToggle={(s, m) => {
                  onToggle(m, s);
                }}
              />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {columns.map((column) => (
              <div key={column.key} className="min-w-0">
                <p className="caps-label mb-1.5">{column.label}</p>
                <div
                  role="group"
                  aria-label={`${marketTitle(market)}, ${column.label}`}
                  className="grid gap-1.5"
                >
                  {column.cells.map((cell) => (
                    <SelectionButton
                      key={cell.selection.id}
                      selection={cell.selection}
                      market={market}
                      size="sm"
                      selected={selectedIds.has(cell.selection.id)}
                      matchLabel={matchLabel}
                      onToggle={(s, m) => {
                        onToggle(m, s);
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
