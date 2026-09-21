import { cn } from "../lib/cn";
import { Button } from "../ui/Button";

export interface FormActionsProps {
  readonly submitLabel?: string;
  readonly resetLabel?: string;
  readonly onReset?: () => void;
  readonly loading?: boolean;
  /** When given, submit and reset stay disabled until the form has changes. */
  readonly dirty?: boolean;
  readonly disabled?: boolean;
  readonly tone?: "primary" | "danger";
  readonly align?: "start" | "end" | "between";
  readonly children?: React.ReactNode;
  readonly className?: string;
}

const ALIGN: Record<NonNullable<FormActionsProps["align"]>, string> = {
  start: "justify-start",
  end: "justify-end",
  between: "justify-between",
};

export function FormActions({
  submitLabel = "Save changes",
  resetLabel = "Reset",
  onReset,
  loading = false,
  dirty,
  disabled = false,
  tone = "primary",
  align = "end",
  children,
  className,
}: FormActionsProps): React.JSX.Element {
  const pristine = dirty === false;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", ALIGN[align], className)}>
      {dirty === true && !loading && (
        <p role="status" className="mr-auto text-sm text-text-muted">
          Unsaved changes
        </p>
      )}
      {children}
      {onReset !== undefined && (
        <Button
          variant="ghost"
          type="reset"
          disabled={loading || pristine}
          onClick={onReset}
        >
          {resetLabel}
        </Button>
      )}
      <Button
        type="submit"
        variant={tone}
        loading={loading}
        disabled={disabled || pristine}
      >
        {submitLabel}
      </Button>
    </div>
  );
}
