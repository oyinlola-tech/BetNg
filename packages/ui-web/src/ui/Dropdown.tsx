import { Children, useEffect, useId, useRef, useState } from "react";
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
  readonly items?: readonly DropdownItem[];
  /** Renders a free-form panel (checkbox lists, filters) instead of a menu. It stays open while the content is used. */
  readonly children?: React.ReactNode;
  readonly align?: "start" | "end";
  readonly className?: string;
}

const FOCUSABLE =
  '[role="menuitem"]:not(:disabled), input:not(:disabled), button:not(:disabled), select:not(:disabled), a[href]';

export function Dropdown({ label, trigger, items = [], children, align = "end", className }: DropdownProps): React.JSX.Element {
  const panel = children !== undefined;
  const rowCount = panel ? Children.count(children) : items.length;
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<React.CSSProperties>({});
  const root = useRef<HTMLDivElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;

    const onPointer = (event: PointerEvent): void => {
      if (root.current !== null && !root.current.contains(event.target as Node)) setOpen(false);
    };

    const close = (): void => {
      setOpen(false);
    };

    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    popup.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
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
        if (event.key === "Escape" && open) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          root.current?.querySelector<HTMLButtonElement>("[aria-haspopup]")?.focus();
        }
        if (panel) return;
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
        aria-haspopup={panel ? "dialog" : "menu"}
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={label}
        onClick={() => {
          const rect = root.current?.getBoundingClientRect();

          // Fixed to the viewport so a scrolling table or panel cannot clip the menu.
          if (rect !== undefined) {
            const below = window.innerHeight - rect.bottom > rowCount * 34 + 24;

            setPosition({
              ...(below ? { top: rect.bottom + 4 } : { bottom: window.innerHeight - rect.top + 4 }),
              ...(align === "end" ? { right: window.innerWidth - rect.right } : { left: rect.left }),
            });
          }

          setOpen((o) => !o);
        }}
        className="inline-flex items-center rounded-sm focus-ring"
      >
        {trigger}
      </button>
      {open && panel && (
        <div
          ref={popup}
          id={menuId}
          role="dialog"
          aria-label={label}
          style={position}
          className="fixed z-drawer max-h-80 min-w-52 overflow-y-auto rounded-md border border-border bg-surface-elevated p-3 shadow-md animate-fade-in scrollbar-thin"
        >
          {children}
        </div>
      )}
      {open && !panel && (
        <div
          ref={popup}
          id={menuId}
          role="menu"
          aria-label={label}
          style={position}
          className="fixed z-drawer min-w-44 rounded-md border border-border bg-surface-elevated p-1 shadow-md animate-fade-in"
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
