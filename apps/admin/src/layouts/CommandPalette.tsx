import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { CornerDownLeft, Search } from "lucide-react";
import { cn } from "@betng/ui-web";
import type { NavItem } from "../lib/navigation";

export function CommandPalette({ open, onClose, items }: { readonly open: boolean; readonly onClose: () => void; readonly items: readonly NavItem[] }): React.JSX.Element | null {
  const ref = useRef<HTMLDialogElement>(null);
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const matches = useMemo(() => items.filter((item) => item.label.toLowerCase().includes(query.trim().toLowerCase())), [items, query]);

  useEffect(() => {
    const dialog = ref.current;

    if (dialog === null) return;
    if (open && !dialog.open) {
      setQuery("");
      setIndex(0);
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  if (!open) return null;

  const go = (item: NavItem | undefined): void => {
    if (item === undefined) return;
    onClose();
    void navigate(item.to);
  };

  return (
    <dialog
      ref={ref}
      aria-label="Jump to a screen"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className="mx-auto mt-[14vh] w-[calc(100%-2rem)] max-w-lg rounded-lg border border-border bg-surface-elevated p-0 text-text-primary shadow-lg backdrop:bg-overlay animate-fade-in"
    >
      <div className="flex items-center gap-2 border-b border-border px-4">
        <Search className="size-4 text-text-muted" aria-hidden />
        <input
          autoFocus
          value={query}
          role="combobox"
          aria-expanded
          aria-controls="palette-list"
          aria-label="Jump to a screen"
          placeholder="Jump to a screen"
          onChange={(event) => {
            setQuery(event.target.value);
            setIndex(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setIndex((i) => Math.min(matches.length - 1, i + 1));
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setIndex((i) => Math.max(0, i - 1));
            }
            if (event.key === "Enter") go(matches[index]);
          }}
          className="h-12 w-full bg-transparent text-md outline-none placeholder:text-text-muted"
        />
      </div>
      <ul id="palette-list" role="listbox" className="max-h-80 overflow-y-auto p-1.5 scrollbar-thin">
        {matches.length === 0 && <li className="px-3 py-6 text-center text-sm text-text-muted">No screen matches “{query}”.</li>}
        {matches.map((item, i) => (
          <li key={item.to} role="option" aria-selected={i === index}>
            <button
              type="button"
              onMouseEnter={() => {
                setIndex(i);
              }}
              onClick={() => {
                go(item);
              }}
              className={cn("flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-left text-base", i === index ? "bg-brand-subtle text-text-primary" : "text-text-secondary")}
            >
              <item.icon className="size-4 text-text-muted" aria-hidden />
              <span className="flex-1">{item.label}</span>
              {i === index && <CornerDownLeft className="size-3.5 text-text-muted" aria-hidden />}
            </button>
          </li>
        ))}
      </ul>
    </dialog>
  );
}
