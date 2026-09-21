import { ArrowRight, Lock, X } from "lucide-react";
import { formatOdds, type SlipSelection } from "@betng/ui-core";
import { ToneTag } from "../domain/ToneTag";
import { cn } from "../lib/cn";

export type BetSlipSelectionStatus =
  | { readonly kind: "OK" }
  | { readonly kind: "PRICE_CHANGED"; readonly currentOdds: number }
  | { readonly kind: "SUSPENDED" }
  | { readonly kind: "CLOSED" };

const OK: BetSlipSelectionStatus = { kind: "OK" };

export interface BetSlipSelectionProps {
  readonly selection: SlipSelection;
  readonly status?: BetSlipSelectionStatus;
  readonly onRemove?: ((selection: SlipSelection) => void) | undefined;
  readonly disabled?: boolean;
  readonly className?: string | undefined;
}

export function BetSlipSelection({
  selection,
  status = OK,
  onRemove,
  disabled = false,
  className,
}: BetSlipSelectionProps): React.JSX.Element {
  const blocked = status.kind === "SUSPENDED" || status.kind === "CLOSED";

  return (
    <li
      data-status={status.kind}
      className={cn("flex items-start gap-2 py-3", className)}
    >
      <div className="min-w-0 flex-1">
        <p className="type-small truncate text-text-muted">
          {selection.leagueCode} · {selection.matchLabel}
        </p>
        <p
          className={cn(
            "type-body truncate font-semibold",
            blocked ? "text-text-secondary" : "text-text-primary",
          )}
        >
          {selection.selectionLabel}
        </p>
        <p className="type-small truncate text-text-secondary">
          {selection.marketName}
        </p>
        {status.kind === "PRICE_CHANGED" && (
          <p role="status" className="mt-1 flex items-center gap-1.5">
            <ToneTag tone="warning">Price changed</ToneTag>
            <span className="type-small inline-flex items-center gap-1 tabular text-text-secondary">
              <s>{formatOdds(selection.odds)}</s>
              <ArrowRight className="size-3" aria-hidden />
              <span className="sr-only">now</span>
              <span className="font-bold text-text-primary">
                {formatOdds(status.currentOdds)}
              </span>
            </span>
          </p>
        )}
        {status.kind === "SUSPENDED" && (
          <p role="status" className="mt-1">
            <ToneTag
              tone="suspended"
              icon={<Lock className="size-3" aria-hidden />}
            >
              Suspended
            </ToneTag>
          </p>
        )}
        {status.kind === "CLOSED" && (
          <p role="status" className="mt-1">
            <ToneTag tone="muted" icon={<Lock className="size-3" aria-hidden />}>
              Closed
            </ToneTag>
          </p>
        )}
      </div>
      <span
        className={cn(
          "type-odds shrink-0 pt-4",
          status.kind === "OK" ? "text-text-primary" : "text-text-muted",
        )}
      >
        <span className="sr-only">Odds when added </span>
        {formatOdds(selection.odds)}
      </span>
      {onRemove !== undefined && (
        <button
          type="button"
          disabled={disabled}
          aria-label={`Remove ${selection.selectionLabel}, ${selection.matchLabel}`}
          onClick={() => {
            onRemove(selection);
          }}
          className="flex size-8 shrink-0 items-center justify-center rounded-sm text-text-muted transition-colors duration-[var(--bn-duration-fast)] hover:bg-surface-hover hover:text-text-primary focus-ring disabled:opacity-45 pointer-coarse:size-11"
        >
          <X className="size-4" aria-hidden />
        </button>
      )}
    </li>
  );
}
