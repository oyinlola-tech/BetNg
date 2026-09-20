import { ArrowDown, ArrowUp } from "lucide-react";
import { formatOdds, type SelectionView } from "@betng/ui-core";
import { cn } from "../lib/cn";

export interface OddsButtonProps {
  readonly selection: SelectionView;
  readonly selected: boolean;
  readonly disabled?: boolean;
  readonly onToggle: (selection: SelectionView) => void;
  readonly compact?: boolean;
  readonly className?: string;
}

export function OddsButton({
  selection,
  selected,
  disabled = false,
  onToggle,
  compact = false,
  className,
}: OddsButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${selection.label}, odds ${formatOdds(selection.odds)}`}
      disabled={disabled}
      onClick={() => {
        onToggle(selection);
      }}
      className={cn(
        "group flex min-w-0 items-center justify-between gap-2 rounded-sm border transition-colors duration-[var(--bn-duration-fast)] focus-ring disabled:opacity-40",
        compact ? "h-10 px-2.5" : "h-11 px-3",
        selected
          ? "border-brand bg-brand text-text-on-brand"
          : "border-transparent bg-surface-sunken text-text-primary hover:border-border-strong",
        className,
      )}
    >
      <span
        className={cn(
          "truncate text-sm",
          selected ? "text-text-on-brand/90" : "text-text-secondary",
        )}
      >
        {compact ? selection.shortLabel : selection.label}
      </span>
      <span className="inline-flex items-center gap-0.5 text-base font-bold tabular">
        {selection.trend === "UP" && (
          <ArrowUp
            className={cn(
              "size-3",
              selected ? "text-text-on-brand/80" : "text-success",
            )}
            aria-label="up"
          />
        )}
        {selection.trend === "DOWN" && (
          <ArrowDown
            className={cn(
              "size-3",
              selected ? "text-text-on-brand/80" : "text-danger",
            )}
            aria-label="down"
          />
        )}
        {formatOdds(selection.odds)}
      </span>
    </button>
  );
}
