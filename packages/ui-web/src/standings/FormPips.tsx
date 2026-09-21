import type { FormResult } from "@betng/ui-core";
import { cn } from "../lib/cn";

const RESULT_WORD: Readonly<Record<FormResult, string>> = {
  W: "win",
  D: "draw",
  L: "loss",
};

const RESULT_CLASS: Readonly<Record<FormResult, string>> = {
  W: "bg-success text-text-on-status",
  D: "bg-border-strong text-text-primary",
  L: "bg-danger text-text-on-status",
};

export interface FormPipsProps {
  readonly form: readonly FormResult[];
  readonly size?: "sm" | "lg";
  readonly className?: string | undefined;
}

export function FormPips({
  form,
  size = "sm",
  className,
}: FormPipsProps): React.JSX.Element {
  return (
    <span
      role="img"
      aria-label={
        form.length === 0
          ? "No recent form"
          : `Form: ${form.map((r) => RESULT_WORD[r]).join(", ")}`
      }
      className={cn("inline-flex gap-0.5", className)}
    >
      {form.length === 0 && (
        <span className="type-small text-text-muted">–</span>
      )}
      {form.map((result, position) => (
        // Form is an ordered run of results with no identity of its own.
        <span
          key={position}
          aria-hidden
          className={cn(
            "inline-flex items-center justify-center rounded-xs font-bold",
            size === "sm" ? "size-4 text-[9px]" : "size-7 text-sm",
            RESULT_CLASS[result],
          )}
        >
          {result}
        </span>
      ))}
    </span>
  );
}
