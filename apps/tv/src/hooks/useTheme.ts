import { useCallback, useSyncExternalStore } from "react";

export type TvTheme = "dark" | "light";

const KEY = "betng.tv.theme";
const listeners = new Set<() => void>();

function read(): TvTheme {
  try {
    return localStorage.getItem(KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function useTvTheme(): readonly [TvTheme, () => void] {
  const theme = useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
    read,
    () => "dark" as const,
  );

  const toggle = useCallback(() => {
    const next: TvTheme = read() === "dark" ? "light" : "dark";

    try {
      localStorage.setItem(KEY, next);
    } catch {
    }
    document.documentElement.dataset["theme"] = next;
    for (const l of listeners) l();
  }, []);

  return [theme, toggle];
}
