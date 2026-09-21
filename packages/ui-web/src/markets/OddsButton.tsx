import { useState } from "react";
import { ArrowDown, ArrowUp, Lock } from "lucide-react";
import {
  formatOdds,
  type OddsTrend,
  type SelectionView,
} from "@betng/ui-core";
import { cn } from "../lib/cn";

export type OddsButtonState =
  | "default"
  | "selected"
  | "suspended"
  | "unavailable"
  | "loading";

export type OddsChange = "UP" | "DOWN";

const SIZES = {
  md: "h-10 flex-col justify-center gap-0 px-2",
  sm: "h-8 flex-row items-center justify-between gap-2 px-2",
} as const;

const CHANGE_WORD: Readonly<Record<OddsChange, string>> = {
  UP: "price up",
  DOWN: "price down",
};

export interface OddsButtonProps {
  /** Required unless the legacy `selection` is given. */
  readonly label?: string | undefined;
  readonly odds?: number | undefined;
  readonly state?: OddsButtonState | undefined;
  /** A movement the platform reported. */
  readonly change?: OddsChange | undefined;
  readonly size?: keyof typeof SIZES;
  readonly onSelect?: (() => void) | undefined;
  /** Market and match, for the accessible name. */
  readonly accessibleContext?: string | undefined;
  readonly className?: string | undefined;

  /** @deprecated Pass `label` and `odds`, or use `SelectionButton`. */
  readonly selection?: SelectionView | undefined;
  /** @deprecated Use `state="selected"`. */
  readonly selected?: boolean | undefined;
  readonly disabled?: boolean | undefined;
  /** @deprecated Use `change`. */
  readonly trend?: OddsTrend | undefined;
  /** @deprecated Shows the legacy selection's short label. */
  readonly compact?: boolean | undefined;
  /** @deprecated Use `onSelect`. */
  readonly onToggle?: ((selection: SelectionView) => void) | undefined;
}

function legacyState(
  selection: SelectionView | undefined,
  selected: boolean | undefined,
): OddsButtonState {
  if (selection?.status === "SUSPENDED") return "suspended";
  if (selection?.status === "UNAVAILABLE") return "unavailable";

  return selected === true ? "selected" : "default";
}

export function OddsButton({
  label,
  odds,
  state,
  change,
  size = "md",
  onSelect,
  accessibleContext,
  className,
  selection,
  selected,
  disabled = false,
  trend,
  compact = false,
  onToggle,
}: OddsButtonProps): React.JSX.Element {
  const price = odds ?? selection?.odds;
  const text =
    label ?? (compact ? selection?.shortLabel : selection?.label) ?? "";
  const resolved = state ?? legacyState(selection, selected);

  // The price is the platform's; the client only notices that it moved.
  const [previous, setPrevious] = useState(price);
  const [detected, setDetected] = useState<
    { readonly direction: OddsChange; readonly stamp: number } | undefined
  >(undefined);

  if (price !== previous) {
    setPrevious(price);

    if (price !== undefined && previous !== undefined) {
      setDetected({
        direction: price > previous ? "UP" : "DOWN",
        stamp: (detected?.stamp ?? 0) + 1,
      });
    }
  }

  const reported =
    change ?? (trend === "UP" || trend === "DOWN" ? trend : undefined) ??
    (selection?.trend === "UP" || selection?.trend === "DOWN"
      ? selection.trend
      : undefined);
  const direction = detected?.direction ?? reported;
  const tintKey = detected?.stamp ?? (change === undefined ? undefined : 0);

  const isSelected = resolved === "selected";
  const priced = resolved === "default" || isSelected;
  const inert = disabled || !priced || price === undefined;
  const showChange = priced && price !== undefined && direction !== undefined;

  const name = [
    accessibleContext,
    text,
    resolved === "suspended"
      ? "suspended"
      : resolved === "loading"
        ? "loading"
        : resolved === "unavailable" || price === undefined
          ? "unavailable"
          : `odds ${formatOdds(price)}`,
    showChange ? CHANGE_WORD[direction] : undefined,
  ]
    .filter((part) => part !== undefined && part !== "")
    .join(", ");

  return (
    <button
      type="button"
      aria-pressed={isSelected}
      aria-label={name}
      aria-busy={resolved === "loading" || undefined}
      data-state={resolved}
      data-change={showChange ? direction : undefined}
      disabled={inert}
      onClick={() => {
        onSelect?.();
        if (selection !== undefined) onToggle?.(selection);
      }}
      className={cn(
        "relative flex min-w-0 overflow-hidden rounded-sm border transition-colors duration-[var(--bn-duration-fast)] focus-ring pointer-coarse:min-h-11",
        SIZES[size],
        isSelected
          ? "border-brand bg-brand text-text-on-brand"
          : resolved === "suspended"
            ? "border-transparent bg-suspended-subtle text-suspended"
            : "border-transparent bg-surface-sunken text-text-primary",
        priced && !isSelected && !inert && "hover:border-border-strong",
        disabled && priced && "opacity-45",
        resolved === "unavailable" && "text-text-muted",
        className,
      )}
    >
      {showChange && tintKey !== undefined && !isSelected && (
        <span
          key={tintKey}
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0",
            direction === "UP" ? "animate-odds-up" : "animate-odds-down",
          )}
        />
      )}
      <span
        className={cn(
          "type-small relative max-w-full truncate",
          size === "md" && "text-center",
          isSelected
            ? "text-text-on-brand"
            : resolved === "suspended"
              ? "text-suspended"
              : "text-text-secondary",
        )}
      >
        {text}
      </span>
      <span
        className={cn(
          "type-odds relative inline-flex items-center gap-0.5",
          size === "md" && "justify-center",
        )}
      >
        {resolved === "loading" ? (
          <span aria-hidden className="skeleton h-3.5 w-9" />
        ) : resolved === "suspended" ? (
          <Lock className="size-3.5" aria-hidden />
        ) : resolved === "unavailable" || price === undefined ? (
          <span aria-hidden>–</span>
        ) : (
          <>
            {showChange &&
              (direction === "UP" ? (
                <ArrowUp
                  aria-hidden
                  className={cn(
                    "size-3",
                    isSelected ? "text-text-on-brand" : "text-success",
                  )}
                />
              ) : (
                <ArrowDown
                  aria-hidden
                  className={cn(
                    "size-3",
                    isSelected ? "text-text-on-brand" : "text-danger",
                  )}
                />
              ))}
            {formatOdds(price)}
          </>
        )}
      </span>
    </button>
  );
}
