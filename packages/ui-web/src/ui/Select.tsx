import { forwardRef } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../lib/cn";

export interface SelectOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

export interface SelectProps<T extends string> {
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly options: readonly SelectOption<T>[];
  /** The accessible name when no visible label points at the control; omit it inside a `Field`. */
  readonly label?: string;
  readonly className?: string;
  readonly size?: "sm" | "md";
  readonly fullWidth?: boolean;
  readonly disabled?: boolean;
  readonly name?: string;
  readonly id?: string;
  readonly onBlur?: () => void;
  readonly "aria-describedby"?: string;
  readonly "aria-invalid"?: true;
  readonly "aria-required"?: true;
}

function SelectInner<T extends string>(
  {
    value,
    onChange,
    options,
    label,
    className,
    size = "md",
    fullWidth = false,
    ...rest
  }: SelectProps<T>,
  ref: React.ForwardedRef<HTMLSelectElement>,
): React.JSX.Element {
  return (
    <div
      className={cn(
        "relative",
        fullWidth ? "flex w-full" : "inline-flex",
        className,
      )}
    >
      <select
        ref={ref}
        {...rest}
        {...(label === undefined ? {} : { "aria-label": label })}
        value={value}
        onChange={(event) => {
          onChange(event.target.value as T);
        }}
        className={cn(
          "appearance-none rounded-sm border bg-surface pl-3 pr-8 font-medium text-text-primary focus-ring hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-45",
          rest["aria-invalid"] === true ? "border-danger" : "border-border",
          size === "sm" ? "h-8 text-sm" : "h-10 text-base",
          fullWidth && "w-full",
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-text-muted"
      />
    </div>
  );
}

export const Select = forwardRef(SelectInner) as <T extends string>(
  props: SelectProps<T> & { readonly ref?: React.Ref<HTMLSelectElement> },
) => React.JSX.Element;
