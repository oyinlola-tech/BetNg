import { useEffect, useId, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { tabId, tabPanelId } from "./tabIds";

export interface TabItem<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly count?: number;
  readonly disabled?: boolean;
}

export interface TabsProps<T extends string> {
  readonly items: readonly TabItem<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly variant?: "underline" | "segmented";
  /** Shared with each `TabPanel` as `tabsId`; enables `aria-controls`. */
  readonly id?: string;
  /** One horizontally scrolling row with faded edges, for long tab sets on narrow screens. */
  readonly scrollable?: boolean;
  readonly className?: string;
  readonly label?: string;
}

interface Overflow {
  readonly start: boolean;
  readonly end: boolean;
}

const FADE =
  "pointer-events-none absolute inset-y-0 w-8 from-background to-transparent";

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  variant = "underline",
  id,
  scrollable = false,
  className,
  label,
}: TabsProps<T>): React.JSX.Element {
  const autoId = useId();
  const baseId = id ?? autoId;
  const list = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState<Overflow>({
    start: false,
    end: false,
  });

  useEffect(() => {
    const node = list.current;

    if (!scrollable || node === null) return;

    const measure = (): void => {
      const start = node.scrollLeft > 1;
      const end = node.scrollLeft + node.clientWidth < node.scrollWidth - 1;

      setOverflow((current) =>
        current.start === start && current.end === end
          ? current
          : { start, end },
      );
    };

    measure();
    node.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);

    return () => {
      node.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [scrollable, items]);

  useEffect(() => {
    if (!scrollable) return;

    const node = document.getElementById(tabId(baseId, value));

    if (typeof node?.scrollIntoView === "function")
      node.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [scrollable, baseId, value]);

  const select = (item: TabItem<T> | undefined): void => {
    if (item === undefined) return;

    onChange(item.value);
    document.getElementById(tabId(baseId, item.value))?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const enabled = items.filter((item) => item.disabled !== true);
    const index = enabled.findIndex((item) => item.value === value);

    if (enabled.length === 0) return;

    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      select(
        enabled[
          (index + (event.key === "ArrowRight" ? 1 : enabled.length - 1)) %
            enabled.length
        ],
      );
    } else if (event.key === "Home") {
      event.preventDefault();
      select(enabled[0]);
    } else if (event.key === "End") {
      event.preventDefault();
      select(enabled[enabled.length - 1]);
    }
  };

  const tablist = (
    <div
      ref={list}
      role="tablist"
      aria-label={label}
      aria-orientation="horizontal"
      onKeyDown={onKeyDown}
      className={cn(
        "flex",
        variant === "underline" && "gap-1 border-b border-border",
        variant === "segmented" && "gap-0.5 rounded-sm bg-surface-sunken p-0.5",
        scrollable &&
          "snap-x overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        !scrollable && className,
      )}
    >
      {items.map((item) => {
        const selected = item.value === value;

        return (
          <button
            key={item.value}
            id={tabId(baseId, item.value)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={
              id === undefined ? undefined : tabPanelId(id, item.value)
            }
            tabIndex={selected ? 0 : -1}
            disabled={item.disabled}
            onClick={() => {
              onChange(item.value);
            }}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap font-semibold transition-colors duration-[var(--bn-duration-fast)] focus-ring disabled:cursor-not-allowed disabled:opacity-45",
              scrollable && "snap-start",
              variant === "underline" &&
                cn(
                  "-mb-px h-10 border-b-2 px-3 text-sm",
                  selected
                    ? "border-brand text-text-primary"
                    : "border-transparent text-text-muted hover:text-text-primary",
                ),
              variant === "segmented" &&
                cn(
                  "h-8 justify-center rounded-xs px-3 text-sm",
                  !scrollable && "flex-1",
                  selected
                    ? "bg-surface text-text-primary shadow-sm"
                    : "text-text-muted hover:text-text-primary",
                ),
            )}
          >
            {item.label}
            {item.count !== undefined && (
              <span
                className={cn(
                  "rounded-xs px-1 text-[10px] tabular",
                  selected
                    ? "bg-brand-subtle text-brand"
                    : "bg-surface-sunken text-text-muted",
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  if (!scrollable) return tablist;

  return (
    <div className={cn("relative min-w-0", className)}>
      {tablist}
      {overflow.start && (
        <span aria-hidden className={cn(FADE, "left-0 bg-linear-to-r")} />
      )}
      {overflow.end && (
        <span aria-hidden className={cn(FADE, "right-0 bg-linear-to-l")} />
      )}
    </div>
  );
}
