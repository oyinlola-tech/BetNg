import { useId, useRef } from "react";
import { cn } from "../lib/cn";

export interface CodeInputProps {
  readonly label: string;
  readonly length: number;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onComplete?: (value: string) => void;
  /** Hides the digits, for a PIN. */
  readonly masked?: boolean;
  readonly error?: string | undefined;
  readonly disabled?: boolean;
  readonly autoFocus?: boolean;
  readonly className?: string;
}

/** A segmented one-time-code / PIN entry backed by a single real input, so paste, autofill and screen readers behave. */
export function CodeInput({ label, length, value, onChange, onComplete, masked = false, error, disabled = false, autoFocus = false, className }: CodeInputProps): React.JSX.Element {
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-text-secondary">
        {label}
      </label>
      <div
        className="relative inline-flex gap-2"
        onClick={() => {
          ref.current?.focus();
        }}
      >
        <input
          ref={ref}
          id={id}
          value={value}
          disabled={disabled}
          autoFocus={autoFocus}
          inputMode="numeric"
          autoComplete={masked ? "off" : "one-time-code"}
          maxLength={length}
          aria-invalid={error !== undefined}
          aria-describedby={error !== undefined ? `${id}-error` : undefined}
          onChange={(event) => {
            const next = event.target.value.replace(/\D/g, "").slice(0, length);

            onChange(next);
            if (next.length === length) onComplete?.(next);
          }}
          className="peer absolute inset-0 h-full w-full cursor-text opacity-0"
        />
        {Array.from({ length }, (_, index) => {
          const char = value[index];
          const active = index === Math.min(value.length, length - 1);

          return (
            <span
              key={index}
              aria-hidden
              className={cn(
                "flex h-12 w-10 items-center justify-center rounded-sm border bg-surface-sunken font-display text-xl font-semibold tabular text-text-primary transition-colors",
                error !== undefined ? "border-danger" : "border-border",
                active && "peer-focus:border-brand peer-focus:ring-2 peer-focus:ring-brand-subtle",
                disabled && "opacity-50",
              )}
            >
              {char === undefined ? "" : masked ? "•" : char}
            </span>
          );
        })}
      </div>
      {error !== undefined && (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
