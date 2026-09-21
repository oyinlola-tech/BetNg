import { cloneElement, isValidElement, useId } from "react";
import { cn } from "../lib/cn";

export interface FieldControlProps {
  readonly id: string;
  readonly "aria-describedby"?: string;
  readonly "aria-invalid"?: true;
  readonly "aria-required"?: true;
}

export interface FieldProps {
  readonly label: string;
  readonly hint?: string;
  readonly error?: string | undefined;
  readonly required?: boolean;
  readonly hideLabel?: boolean;
  /** Overrides the generated control id. */
  readonly id?: string;
  readonly className?: string;
  /** A single control element, or a function that receives the wiring props. */
  readonly children:
    | React.ReactElement<Partial<FieldControlProps>>
    | ((control: FieldControlProps) => React.ReactNode);
}

export function Field({
  label,
  hint,
  error,
  required = false,
  hideLabel = false,
  id,
  className,
  children,
}: FieldProps): React.JSX.Element {
  const autoId = useId();
  const controlId = id ?? autoId;
  const hintId = `${controlId}-hint`;
  const errorId = `${controlId}-error`;
  const invalid = error !== undefined && error !== "";

  const describedBy = [invalid ? errorId : undefined, hint === undefined ? undefined : hintId]
    .filter((value) => value !== undefined)
    .join(" ");

  const control: FieldControlProps = {
    id: controlId,
    ...(describedBy === "" ? {} : { "aria-describedby": describedBy }),
    ...(invalid ? { "aria-invalid": true as const } : {}),
    ...(required ? { "aria-required": true as const } : {}),
  };

  return (
    <div className={className}>
      <label
        htmlFor={controlId}
        className={cn(
          "mb-1.5 block text-sm font-medium text-text-secondary",
          hideLabel && "sr-only",
        )}
      >
        {label}
        {required && (
          <span aria-hidden className="ml-0.5 text-danger">
            *
          </span>
        )}
      </label>
      {typeof children === "function"
        ? children(control)
        : isValidElement(children)
          ? cloneElement(children, control)
          : children}
      {hint !== undefined && (
        <p id={hintId} className="mt-1 text-sm text-text-muted">
          {hint}
        </p>
      )}
      {invalid && (
        <p id={errorId} className="mt-1 text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
