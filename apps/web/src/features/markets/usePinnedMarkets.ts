import { useMemo } from "react";
import { usePinnedMarketStore } from "../../stores/pinnedMarkets.store";

export interface PinnedMarkets {
  readonly pinned: ReadonlySet<string>;
  readonly togglePin: (kind: string) => void;
}

export function usePinnedMarkets(): PinnedMarkets {
  const kinds = usePinnedMarketStore((state) => state.kinds);
  const togglePin = usePinnedMarketStore((state) => state.toggle);
  const pinned = useMemo(() => new Set(kinds), [kinds]);

  return { pinned, togglePin };
}
