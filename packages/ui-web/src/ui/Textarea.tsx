import { forwardRef, useId } from "react";
import { cn } from "../lib/cn";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  readonly label: string;
  readonly hint?: string;
  readonly error?: string | undefined;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ label, hint, error, className, id, rows = 3, ...rest }, ref) {
  const autoId = useId();
  const inputId = id ?? autoId;

  return (
    <div className={className}>
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-text-secondary">
        {label}
      </label>
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        aria-invalid={error !== undefined}
        aria-describedby={error !== undefined ? `${inputId}-error` : hint !== undefined ? `${inputId}-hint` : undefined}
        className={cn(
          "w-full resize-y rounded-sm border bg-surface-sunken px-3 py-2 text-base text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-brand",
          error === undefined ? "border-border" : "border-danger",
        )}
        {...rest}
      />
      {error !== undefined ? (
        <p id={`${inputId}-error`} className="mt-1 text-sm text-danger">
          {error}
        </p>
      ) : hint !== undefined ? (
        <p id={`${inputId}-hint`} className="mt-1 text-sm text-text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
