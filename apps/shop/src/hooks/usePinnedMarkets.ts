import { useCallback, useMemo, useState } from "react";

const STORAGE_KEY = "betng.shop.pinned-markets";

function read(): readonly string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (raw === null) return [];

    const parsed: unknown = JSON.parse(raw);

    return Array.isArray(parsed) ? parsed.filter((k) => typeof k === "string") : [];
  } catch {
    return [];
  }
}

export interface PinnedMarkets {
  readonly pinned: ReadonlySet<string>;
  readonly togglePin: (kind: string) => void;
}

/** Which market kinds this terminal keeps at the top. A local preference; nothing reaches the platform. */
export function usePinnedMarkets(): PinnedMarkets {
  const [kinds, setKinds] = useState<readonly string[]>(read);

  const togglePin = useCallback((kind: string) => {
    setKinds((current) => {
      const next = current.includes(kind) ? current.filter((k) => k !== kind) : [...current, kind];

      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // A terminal with storage blocked still pins for this session.
      }

      return next;
    });
  }, []);

  const pinned = useMemo(() => new Set(kinds), [kinds]);

  return { pinned, togglePin };
}
