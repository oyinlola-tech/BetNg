import { useSyncExternalStore } from "react";

const KEY = "betng.tv.favourites";
const MAX = 64;
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const EMPTY: ReadonlySet<string> = new Set();

export function parseFavourites(raw: string | null): ReadonlySet<string> {
  if (raw === null || raw.length > 8192) return EMPTY;

  try {
    const value: unknown = JSON.parse(raw);

    if (!Array.isArray(value)) return EMPTY;

    return new Set(value.filter((v): v is string => typeof v === "string" && ID.test(v)).slice(0, MAX));
  } catch {
    return EMPTY;
  }
}

const listeners = new Set<() => void>();
let current: ReadonlySet<string> | undefined;

export function getFavourites(): ReadonlySet<string> {
  if (current === undefined) {
    let raw: string | null;

    try {
      raw = localStorage.getItem(KEY);
    } catch {
      raw = null;
    }
    current = parseFavourites(raw);
  }

  return current;
}

export function toggleFavourite(teamId: string): void {
  if (!ID.test(teamId)) return;

  const next = new Set(getFavourites());

  if (next.has(teamId)) next.delete(teamId);
  else if (next.size < MAX) next.add(teamId);

  current = next;
  try {
    localStorage.setItem(KEY, JSON.stringify([...next]));
  } catch {
  }
  for (const l of listeners) l();
}

export function reloadFavourites(): void {
  current = undefined;
}

export function useFavourites(): ReadonlySet<string> {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);

      return () => {
        listeners.delete(onChange);
      };
    },
    getFavourites,
    () => EMPTY,
  );
}

export function follows(favourites: ReadonlySet<string>, ...teamIds: readonly string[]): boolean {
  return teamIds.some((id) => favourites.has(id));
}
