import { useId } from "react";
import { cn } from "../lib/cn";

export interface RadioOption<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly description?: string;
  readonly disabled?: boolean;
}

export interface RadioGroupProps<T extends string> {
  readonly legend: string;
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly options: readonly RadioOption<T>[];
  readonly layout?: "stack" | "row";
  readonly className?: string;
}

export function RadioGroup<T extends string>({ legend, value, onChange, options, layout = "stack", className }: RadioGroupProps<T>): React.JSX.Element {
  const name = useId();

  return (
    <fieldset className={className}>
      <legend className="mb-1.5 text-sm font-medium text-text-secondary">{legend}</legend>
      <div className={cn("flex gap-2", layout === "stack" ? "flex-col" : "flex-wrap")}>
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "flex cursor-pointer items-start gap-2.5 rounded-sm border px-3 py-2 text-base transition-colors",
              option.value === value ? "border-brand bg-brand-subtle" : "border-border bg-surface hover:bg-surface-hover",
              option.disabled === true && "cursor-not-allowed opacity-50",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              disabled={option.disabled}
              onChange={() => {
                onChange(option.value);
              }}
              className="mt-1 size-3.5 accent-[var(--bn-brand)] focus-ring"
            />
            <span>
              <span className="font-medium text-text-primary">{option.label}</span>
              {option.description !== undefined && <span className="block text-sm text-text-muted">{option.description}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
