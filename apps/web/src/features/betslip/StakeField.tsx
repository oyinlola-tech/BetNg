import { useEffect, useId, useState } from "react";
import {
  QUICK_STAKES,
  currentCurrency,
  formatMoneyCompact,
  parseMoney,
} from "@betng/ui-core";
import { cn } from "@betng/ui-web";
import { amountInputValue } from "../wallet/amount";

export interface StakeFieldProps {
  readonly stake: number;
  readonly onStake: (stake: number) => void;
  readonly max: number;
  readonly error?: React.ReactNode;
  readonly disabled?: boolean;
}

export function StakeField({
  stake,
  onStake,
  max,
  error,
  disabled = false,
}: StakeFieldProps): React.JSX.Element {
  const id = useId();
  const [text, setText] = useState(() => amountInputValue(stake));
  const invalid = error !== undefined && error !== null;

  useEffect(() => {
    setText((current) =>
      (parseMoney(current) ?? 0) === stake ? current : amountInputValue(stake),
    );
  }, [stake]);

  return (
    <div>
      <label htmlFor={id} className="type-caption block">
        Stake
      </label>
      <div
        className={cn(
          "mt-1 flex h-12 items-center rounded-sm border bg-surface-sunken transition-colors focus-within:border-brand",
          invalid ? "border-danger" : "border-border-strong",
        )}
      >
        <span aria-hidden className="pl-3 text-md text-text-muted">
          {currentCurrency().symbol}
        </span>
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          value={text}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? `${id}-error` : undefined}
          onChange={(event) => {
            setText(event.target.value);
            onStake(parseMoney(event.target.value) ?? 0);
          }}
          className="type-financial h-full w-full bg-transparent px-2 text-left text-lg outline-none disabled:opacity-60"
        />
      </div>
      <div role="group" aria-label="Quick stakes" className="mt-2 flex gap-1.5">
        {QUICK_STAKES.filter((quick) => quick <= max).map((quick) => (
          <button
            key={quick}
            type="button"
            disabled={disabled}
            aria-pressed={stake === quick}
            onClick={() => {
              onStake(quick);
            }}
            className={cn(
              "h-8 min-w-0 flex-1 rounded-sm border text-xs font-semibold tabular transition-colors focus-ring disabled:opacity-45 pointer-coarse:h-11",
              stake === quick
                ? "border-brand bg-brand-subtle text-brand"
                : "border-border bg-surface text-text-secondary hover:bg-surface-hover",
            )}
          >
            {formatMoneyCompact(quick)}
          </button>
        ))}
      </div>
      <div id={`${id}-error`} aria-live="polite">
        {invalid && <p className="mt-2 text-sm font-medium text-danger">{error}</p>}
      </div>
    </div>
  );
}
