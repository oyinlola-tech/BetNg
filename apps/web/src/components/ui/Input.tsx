import { forwardRef, useId } from "react";
import { cn } from "../../lib/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  readonly label?: string;
  readonly hint?: string;
  readonly error?: string;
  readonly prefix?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, prefix, className, id, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;

  return (
    <div className={className}>
      {label !== undefined && (
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-text-secondary">
          {label}
        </label>
      )}
      <div
        className={cn(
          "flex h-10 items-center rounded-sm border bg-surface-sunken transition-colors focus-within:border-brand",
          error === undefined ? "border-border" : "border-danger",
        )}
      >
        {prefix !== undefined && <span className="pl-3 text-base text-text-muted">{prefix}</span>}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error !== undefined}
          aria-describedby={error !== undefined ? `${inputId}-error` : hint !== undefined ? `${inputId}-hint` : undefined}
          className="h-full w-full bg-transparent px-3 text-base text-text-primary tabular outline-none placeholder:text-text-muted"
          {...rest}
        />
      </div>
      {error !== undefined ? (
        <p id={`${inputId}-error`} className="mt-1 text-sm text-danger">{error}</p>
      ) : hint !== undefined ? (
        <p id={`${inputId}-hint`} className="mt-1 text-sm text-text-muted">{hint}</p>
      ) : null}
    </div>
  );
});
