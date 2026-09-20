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
  readonly label: string;
  readonly className?: string;
  readonly size?: "sm" | "md";
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
  size = "md",
}: SelectProps<T>): React.JSX.Element {
  return (
    <div className={cn("relative inline-flex", className)}>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => {
          onChange(event.target.value as T);
        }}
        className={cn(
          "appearance-none rounded-sm border border-border bg-surface pl-3 pr-8 font-medium text-text-primary focus-ring hover:bg-surface-hover",
          size === "sm" ? "h-8 text-sm" : "h-10 text-base",
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
