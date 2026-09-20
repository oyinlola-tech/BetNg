import { forwardRef, useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "../lib/cn";

export interface PasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  readonly label: string;
  readonly hint?: string;
  readonly error?: string | undefined;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput({ label, hint, error, className, id, ...rest }, ref) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const [visible, setVisible] = useState(false);

  return (
    <div className={className}>
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-text-secondary">
        {label}
      </label>
      <div className={cn("flex h-10 items-center rounded-sm border bg-surface-sunken transition-colors focus-within:border-brand", error === undefined ? "border-border" : "border-danger")}>
        <input
          ref={ref}
          id={inputId}
          type={visible ? "text" : "password"}
          aria-invalid={error !== undefined}
          aria-describedby={error !== undefined ? `${inputId}-error` : hint !== undefined ? `${inputId}-hint` : undefined}
          className="h-full w-full bg-transparent px-3 text-base text-text-primary outline-none placeholder:text-text-muted"
          {...rest}
        />
        <button
          type="button"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          onClick={() => {
            setVisible((v) => !v);
          }}
          className="mr-1 flex size-8 items-center justify-center rounded-xs text-text-muted hover:text-text-primary focus-ring"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
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
