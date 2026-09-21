import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { TeamView } from "@betng/ui-core";
import { cn } from "../lib/cn";
import { TeamCrest } from "./TeamCrest";

export type TeamSelectTeam = Pick<TeamView, "id" | "name" | "shortName" | "code" | "colors" | "crest">;

export interface TeamSelectProps<T extends TeamSelectTeam = TeamSelectTeam> {
  readonly teams: readonly T[];
  readonly value: T["id"] | null;
  readonly onChange: (teamId: T["id"], team: T) => void;
  readonly label: string;
  readonly placeholder?: string;
  readonly loading?: boolean;
  readonly disabled?: boolean;
  readonly emptyText?: string;
  readonly size?: "sm" | "md";
  readonly className?: string;
}

function matches(team: TeamSelectTeam, query: string): boolean {
  const q = query.trim().toLowerCase();

  if (q === "") return true;

  return [team.name, team.shortName, team.code].some((field) => field.toLowerCase().includes(q));
}

export function TeamSelect<T extends TeamSelectTeam = TeamSelectTeam>({
  teams,
  value,
  onChange,
  label,
  placeholder = "Select a team",
  loading = false,
  disabled = false,
  emptyText = "No teams match",
  size = "md",
  className,
}: TeamSelectProps<T>): React.JSX.Element {
  const baseId = useId();
  const listId = `${baseId}-list`;
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const selected = useMemo(() => teams.find((t) => t.id === value), [teams, value]);
  const options = useMemo(() => teams.filter((t) => matches(t, query)), [teams, query]);
  const activeIndex = options.length === 0 ? -1 : Math.min(active, options.length - 1);
  const optionId = (index: number): string => `${baseId}-opt-${String(index)}`;

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const node = listRef.current?.children.item(activeIndex);

    if (node instanceof HTMLElement && typeof node.scrollIntoView === "function") node.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  const show = (): void => {
    if (disabled || open) return;
    const at = selected === undefined ? -1 : teams.indexOf(selected);

    setQuery("");
    setActive(Math.max(at, 0));
    setOpen(true);
  };

  const close = (): void => {
    setOpen(false);
    setQuery("");
  };

  const choose = (team: T): void => {
    onChange(team.id, team);
    close();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        event.preventDefault();

        if (!open) {
          show();

          return;
        }

        if (options.length === 0) return;
        const step = event.key === "ArrowDown" ? 1 : -1;

        setActive((activeIndex + step + options.length) % options.length);

        return;
      }
      case "Home":
      case "End": {
        if (!open || options.length === 0) return;
        event.preventDefault();
        setActive(event.key === "Home" ? 0 : options.length - 1);

        return;
      }
      case "Enter": {
        if (!open) return;
        event.preventDefault();
        const team = options[activeIndex];

        if (team !== undefined) choose(team);

        return;
      }
      case "Escape": {
        if (!open) return;
        event.preventDefault();
        close();

        return;
      }
      default:
    }
  };

  return (
    <div
      className={cn("relative", className)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) close();
      }}
    >
      <div
        className={cn(
          "flex items-center gap-2 rounded-sm border border-border-strong bg-surface px-2.5 transition-colors focus-within:border-brand hover:bg-surface-hover",
          size === "sm" ? "h-8" : "h-10",
          disabled && "cursor-not-allowed opacity-45 hover:bg-surface",
        )}
      >
        {selected !== undefined && !open && <TeamCrest team={selected} size={size === "sm" ? 16 : 20} decorative />}
        <input
          type="text"
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-busy={loading}
          {...(open && activeIndex >= 0 && { "aria-activedescendant": optionId(activeIndex) })}
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          placeholder={selected?.name ?? placeholder}
          value={open ? query : (selected?.name ?? "")}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onClick={show}
          onKeyDown={onKeyDown}
          className={cn(
            "h-full w-full min-w-0 bg-transparent font-medium text-text-primary outline-none placeholder:text-text-muted disabled:cursor-not-allowed",
            size === "sm" ? "text-sm" : "text-base",
          )}
        />
        <ChevronDown aria-hidden className={cn("size-4 shrink-0 text-text-muted transition-transform", open && "rotate-180")} />
      </div>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={label}
          className="absolute inset-x-0 top-full z-sticky mt-1 max-h-64 overflow-y-auto rounded-md border border-border bg-surface-elevated p-1 shadow-md scrollbar-thin"
        >
          {loading ? (
            <li role="presentation" className="flex flex-col gap-1 p-1" aria-hidden>
              <span className="skeleton h-8 rounded-sm" />
              <span className="skeleton h-8 rounded-sm" />
              <span className="skeleton h-8 rounded-sm" />
            </li>
          ) : options.length === 0 ? (
            <li role="presentation" className="type-small px-2.5 py-3 text-text-muted">
              {emptyText}
            </li>
          ) : (
            options.map((team, index) => {
              const isSelected = team.id === value;

              return (
                <li
                  key={team.id}
                  id={optionId(index)}
                  role="option"
                  aria-selected={isSelected}
                  onMouseDown={(event) => {
                    event.preventDefault();
                  }}
                  onClick={() => {
                    choose(team);
                  }}
                  onMouseEnter={() => {
                    setActive(index);
                  }}
                  className={cn(
                    "flex min-h-9 cursor-pointer items-center gap-2.5 rounded-sm px-2 py-1.5 text-base text-text-primary",
                    index === activeIndex && "bg-surface-hover",
                    isSelected && "font-semibold",
                  )}
                >
                  <TeamCrest team={team} size={24} decorative />
                  <span className="min-w-0 flex-1 truncate">{team.name}</span>
                  <span className="type-small tabular text-text-muted">{team.code}</span>
                  {isSelected && <Check aria-hidden className="size-4 shrink-0 text-brand" />}
                </li>
              );
            })
          )}
        </ul>
      )}
      <span role="status" aria-live="polite" className="sr-only">
        {open && (loading ? "Loading teams" : options.length === 0 ? emptyText : `${String(options.length)} teams`)}
      </span>
    </div>
  );
}
