import { useCallback, useSyncExternalStore } from "react";

const KEY = "betng.tv.broadcast";
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === "on";
  } catch {
    return false;
  }
}

export function useBroadcastMode(): readonly [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
    read,
    () => false,
  );

  const set = useCallback((value: boolean) => {
    try {
      localStorage.setItem(KEY, value ? "on" : "off");
    } catch {
    }
    for (const l of listeners) l();
  }, []);

  return [on, set];
}
