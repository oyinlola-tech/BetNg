import { useEffect, useId, useRef, useState } from "react";
import { cn } from "../lib/cn";

export interface DropdownItem {
  readonly key: string;
  readonly label: string;
  readonly icon?: React.ReactNode;
  readonly tone?: "default" | "danger";
  readonly disabled?: boolean;
  /** Shown as a tooltip when the item is disabled, e.g. the permission it needs. */
  readonly disabledReason?: string;
  readonly onSelect: () => void;
}

export interface DropdownProps {
  readonly label: string;
  readonly trigger: React.ReactNode;
  readonly items: readonly DropdownItem[];
  readonly align?: "start" | "end";
  readonly className?: string;
}

/** An action menu: arrow keys move, Enter selects, Escape or an outside click closes. */
export function Dropdown({ label, trigger, items, align = "end", className }: DropdownProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;

    const onPointer = (event: PointerEvent): void => {
      if (root.current !== null && !root.current.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener("pointerdown", onPointer);
    root.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus();

    return () => {
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const move = (delta: number): void => {
    const nodes = Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? []);
    const index = nodes.indexOf(document.activeElement as HTMLButtonElement);

    nodes[(index + delta + nodes.length) % nodes.length]?.focus();
  };

  return (
    <div
      ref={root}
      className={cn("relative inline-flex", className)}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(false);
          root.current?.querySelector<HTMLButtonElement>("[aria-haspopup]")?.focus();
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          move(1);
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          move(-1);
        }
      }}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={label}
        onClick={() => {
          setOpen((o) => !o);
        }}
        className="inline-flex items-center rounded-sm focus-ring"
      >
        {trigger}
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          className={cn("absolute top-full z-drawer mt-1 min-w-44 rounded-md border border-border bg-surface-elevated p-1 shadow-md animate-fade-in", align === "end" ? "right-0" : "left-0")}
        >
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              title={item.disabled === true ? item.disabledReason : undefined}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-xs px-2.5 py-1.5 text-left text-base outline-none transition-colors focus-visible:bg-surface-hover disabled:opacity-40",
                item.tone === "danger" ? "text-danger hover:bg-danger-subtle" : "text-text-primary hover:bg-surface-hover",
              )}
            >
              {item.icon !== undefined && <span className="flex size-4 items-center justify-center text-current [&>svg]:size-4">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
