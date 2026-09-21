import { useEffect, useId, useRef, useState } from "react";
import { SearchX } from "lucide-react";
import { EmptyState, SearchInput, useFlag } from "@betng/ui-web";
import { SearchResultList, useRecentSearches, useSearchResults } from "../features/search";
import { usePageMeta } from "../features/seo";
import { useUrlState } from "../lib/urlState";

export function SearchPage(): React.JSX.Element {
  const enabled = useFlag("searchEnabled");
  const listId = useId();
  const [params, patch] = useUrlState();
  const term = params.get("q") ?? "";
  const [input, setInput] = useState(term);
  const state = useSearchResults(input, 50);
  const recent = useRecentSearches();

  usePageMeta({ title: term === "" ? "Search" : `Search: ${term}`, noindex: true });

  const written = useRef(term);

  useEffect(() => {
    if (term === written.current) return;

    written.current = term;
    setInput(term);
  }, [term]);

  useEffect(() => {
    if (state.term === written.current) return;

    written.current = state.term;
    patch({ q: state.term });
  }, [state.term, patch]);

  if (!enabled) {
    return (
      <div className="mx-auto max-w-lg rounded-md border border-border bg-surface">
        <h1 className="sr-only">Search</h1>
        <EmptyState icon={<SearchX className="size-5" />} title="Search is not available" description="Search is switched off on this platform." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="type-h1">Search</h1>
      <SearchInput value={input} onChange={setInput} label="Search teams, matches, leagues, players and markets" placeholder="Search BETNG" className="h-11" />
      <div className="rounded-md border border-border bg-surface p-1" aria-live="polite">
        <SearchResultList
          state={state}
          listId={listId}
          onPick={() => {
            recent.remember(input);
          }}
          idle={<p className="px-3 py-10 text-center text-sm text-text-muted">Type at least two characters to search the platform.</p>}
        />
      </div>
    </div>
  );
}
