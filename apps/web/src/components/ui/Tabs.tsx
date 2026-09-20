import { useId } from "react";
import { cn } from "../../lib/cn";

export interface TabItem<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly count?: number;
}

export interface TabsProps<T extends string> {
  readonly items: readonly TabItem<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly variant?: "underline" | "segmented";
  readonly className?: string;
  readonly label?: string;
}

export function Tabs<T extends string>({ items, value, onChange, variant = "underline", className, label }: TabsProps<T>): React.JSX.Element {
  const id = useId();

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const index = items.findIndex((i) => i.value === value);

    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const next = items[(index + (event.key === "ArrowRight" ? 1 : items.length - 1)) % items.length];

      if (next !== undefined) {
        onChange(next.value);
        document.getElementById(`${id}-${next.value}`)?.focus();
      }
    }
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        "flex",
        variant === "underline" && "gap-1 border-b border-border",
        variant === "segmented" && "gap-0.5 rounded-sm bg-surface-sunken p-0.5",
        className,
      )}
    >
      {items.map((item) => {
        const selected = item.value === value;

        return (
          <button
            key={item.value}
            id={`${id}-${item.value}`}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => {
              onChange(item.value);
            }}
            className={cn(
              "inline-flex items-center gap-1.5 whitespace-nowrap font-semibold transition-colors duration-[var(--bn-duration-fast)] focus-ring",
              variant === "underline" &&
                cn(
                  "-mb-px h-10 border-b-2 px-3 text-sm",
                  selected ? "border-brand text-text-primary" : "border-transparent text-text-muted hover:text-text-primary",
                ),
              variant === "segmented" &&
                cn(
                  "h-8 flex-1 justify-center rounded-xs px-3 text-sm",
                  selected ? "bg-surface text-text-primary shadow-sm" : "text-text-muted hover:text-text-primary",
                ),
            )}
          >
            {item.label}
            {item.count !== undefined && (
              <span className={cn("rounded-xs px-1 text-[10px] tabular", selected ? "bg-brand-subtle text-brand" : "bg-surface-sunken text-text-muted")}>
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
