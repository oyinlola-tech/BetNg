import { useCallback, useState } from "react";

const KEY = "betng.search.recent";
const LIMIT = 6;

function read(): readonly string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");

    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string").slice(0, LIMIT) : [];
  } catch {
    return [];
  }
}

function write(terms: readonly string[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(terms));
  } catch {
    return;
  }
}

export interface RecentSearches {
  readonly terms: readonly string[];
  readonly remember: (term: string) => void;
  readonly clear: () => void;
}

export function useRecentSearches(): RecentSearches {
  const [terms, setTerms] = useState<readonly string[]>(read);

  const remember = useCallback((term: string) => {
    const clean = term.trim();

    if (clean.length < 2) return;

    const next = [clean, ...read().filter((entry) => entry.toLowerCase() !== clean.toLowerCase())].slice(0, LIMIT);

    write(next);
    setTerms(next);
  }, []);

  const clear = useCallback(() => {
    write([]);
    setTerms([]);
  }, []);

  return { terms, remember, clear };
}
