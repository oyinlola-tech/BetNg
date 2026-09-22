import { useEffect, useId, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowRight, Clock } from "lucide-react";
import type { SearchHit } from "@betng/ui-core";
import { BottomSheet, Button, Dialog, SearchInput, useFlag, useIsDesktop } from "@betng/ui-web";
import { paths, searchHitPath } from "../../lib/paths";
import { useRecentSearches } from "./recentSearches";
import { useSearchDialog } from "./search.store";
import { SearchResultList, hitDomId } from "./SearchResultList";
import { MIN_TERM, useSearchResults } from "./useSearchResults";

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;

  return target.closest("input, textarea, select, [contenteditable=''], [contenteditable='true'], [role='textbox'], dialog[open]") !== null;
}

function SearchBody({ onDone }: { readonly onDone: () => void }): React.JSX.Element {
  const navigate = useNavigate();
  const listId = useId();
  const [input, setInput] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const state = useSearchResults(input, 20);
  const recent = useRecentSearches();
  const active = activeIndex >= 0 ? state.ordered[activeIndex] : undefined;
  const activeId = active === undefined ? undefined : hitDomId(listId, active);

  useEffect(() => {
    setActiveIndex(-1);
  }, [state.term, state.status]);

  useEffect(() => {
    if (activeId !== undefined) document.getElementById(activeId)?.scrollIntoView?.({ block: "nearest" });
  }, [activeId]);

  const open = (hit: SearchHit): void => {
    const to = searchHitPath(hit);

    recent.remember(input);
    onDone();
    if (to !== undefined) void navigate(to);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    const count = state.ordered.length;

    if (event.key === "ArrowDown" && count > 0) {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % count);
    } else if (event.key === "ArrowUp" && count > 0) {
      event.preventDefault();
      setActiveIndex((index) => (index <= 0 ? count - 1 : index - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();

      if (active !== undefined) open(active);
      else if (input.trim().length >= MIN_TERM) {
        recent.remember(input);
        onDone();
        void navigate(paths.search(input.trim()));
      }
    }
  };

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <SearchInput
        autoFocus
        value={input}
        onChange={setInput}
        label="Search teams, matches, leagues, players and markets"
        placeholder="Search BETNG"
        role="combobox"
        aria-expanded={state.status === "results"}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        onKeyDown={onKeyDown}
        className="h-11"
      />
      <div className="-mx-1 max-h-[55dvh] min-h-40 overflow-y-auto scrollbar-thin" aria-live="polite">
        <SearchResultList
          state={state}
          listId={listId}
          activeId={activeId}
          onPick={open}
          onHover={(hit) => {
            setActiveIndex(state.ordered.indexOf(hit));
          }}
          idle={
            recent.terms.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-text-muted">
                Type at least {MIN_TERM} characters. Results come from the platform as you type.
              </p>
            ) : (
              <div className="px-1 py-1">
                <div className="flex items-center justify-between px-2 py-1.5">
                  <p className="type-caption">Recent searches</p>
                  <button type="button" onClick={recent.clear} className="rounded-xs text-sm font-medium text-text-muted hover:text-text-primary focus-ring">
                    Clear
                  </button>
                </div>
                <ul>
                  {recent.terms.map((term) => (
                    <li key={term}>
                      <button
                        type="button"
                        onClick={() => {
                          setInput(term);
                        }}
                        className="flex min-h-11 w-full items-center gap-3 rounded-sm px-2 text-left text-base text-text-secondary hover:bg-surface-hover focus-ring"
                      >
                        <Clock className="size-4 shrink-0 text-text-muted" aria-hidden />
                        <span className="truncate">{term}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )
          }
        />
      </div>
      {state.status === "results" && (
        <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
          <p className="hidden text-sm text-text-muted sm:block">Arrows to move, Enter to open, Escape to close</p>
          <Button
            variant="ghost"
            size="sm"
            trailingIcon={<ArrowRight className="size-3.5" aria-hidden />}
            onClick={() => {
              recent.remember(input);
              onDone();
              void navigate(paths.search(input.trim()));
            }}
          >
            All results
          </Button>
        </div>
      )}
    </div>
  );
}

export function SearchDialog(): React.JSX.Element | null {
  const enabled = useFlag("searchEnabled");
  const desktop = useIsDesktop();
  const open = useSearchDialog((s) => s.open);
  const show = useSearchDialog((s) => s.show);
  const close = useSearchDialog((s) => s.close);

  useEffect(() => {
    if (!enabled) return;

    const onKey = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        show();
      } else if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey && !isTyping(event.target)) {
        event.preventDefault();
        show();
      }
    };

    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [enabled, show]);

  if (!enabled || !open) return null;

  return desktop ? (
    <Dialog open onClose={close} title="Search" size="lg">
      <SearchBody onDone={close} />
    </Dialog>
  ) : (
    <BottomSheet open onClose={close} title="Search">
      <SearchBody onDone={close} />
    </BottomSheet>
  );
}

