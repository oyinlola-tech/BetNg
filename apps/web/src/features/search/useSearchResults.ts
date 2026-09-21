import { DataSourceError, type SearchHit, type SearchKind } from "@betng/ui-core";
import { useDebouncedValue } from "@betng/ui-web";
import { useSearch } from "../../hooks/queries";

export const SEARCH_KINDS: readonly SearchKind[] = ["TEAM", "MATCH", "LEAGUE", "PLAYER", "MARKET"];

export const KIND_LABEL: Readonly<Record<SearchKind, string>> = {
  TEAM: "Teams",
  MATCH: "Matches",
  LEAGUE: "Leagues",
  PLAYER: "Players",
  MARKET: "Markets",
};

export const MIN_TERM = 2;

export type SearchStatus = "idle" | "loading" | "results" | "empty" | "unavailable" | "error";

export interface SearchGroup {
  readonly kind: SearchKind;
  readonly hits: readonly SearchHit[];
}

export interface SearchState {
  readonly status: SearchStatus;
  readonly term: string;
  readonly groups: readonly SearchGroup[];
  /** Hits in display order, for keyboard navigation. */
  readonly ordered: readonly SearchHit[];
  readonly error: unknown;
  readonly retry: () => void;
}

export function useSearchResults(input: string, limit = 24): SearchState {
  const typed = input.trim();
  const term = useDebouncedValue(typed, 250);
  const enabled = term.length >= MIN_TERM;
  const query = useSearch({ term, kinds: SEARCH_KINDS, limit }, enabled);
  const hits = enabled ? (query.data?.hits ?? []) : [];
  const groups = SEARCH_KINDS.map((kind) => ({ kind, hits: hits.filter((hit) => hit.kind === kind) })).filter(
    (group) => group.hits.length > 0,
  );

  let status: SearchStatus;

  if (typed.length < MIN_TERM) status = "idle";
  else if (typed !== term || query.isPending) status = "loading";
  else if (query.isError) status = query.error instanceof DataSourceError && query.error.code === "NOT_IMPLEMENTED" ? "unavailable" : "error";
  else status = groups.length === 0 ? "empty" : "results";

  return {
    status,
    term,
    groups: status === "results" ? groups : [],
    ordered: status === "results" ? groups.flatMap((group) => group.hits) : [],
    error: query.error,
    retry: () => {
      void query.refetch();
    },
  };
}
