import { cn } from "../lib/cn";

export interface SwitchProps {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly label: string;
  readonly description?: string;
  readonly disabled?: boolean;
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: SwitchProps): React.JSX.Element {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center justify-between gap-4 py-3",
        disabled && "opacity-50",
      )}
    >
      <span>
        <span className="block text-base font-medium text-text-primary">
          {label}
        </span>
        {description !== undefined && (
          <span className="block text-sm text-text-muted">{description}</span>
        )}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => {
          onChange(!checked);
        }}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-[var(--bn-duration-base)] focus-ring",
          checked ? "bg-brand" : "bg-border-strong",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute left-0 top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform duration-[var(--bn-duration-base)]",
            checked ? "translate-x-5.5" : "translate-x-0.5",
          )}
        />
      </button>
    </label>
  );
}
