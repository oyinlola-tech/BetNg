import { create } from "zustand";
import { persist } from "zustand/middleware";

/*
 * Which market kinds this person wants at the top of the board. A local
 * display preference and nothing more: it is never sent to the platform, and
 * pinning a kind the current match has no market for simply shows nothing.
 */
interface PinnedMarketState {
  readonly kinds: readonly string[];
  toggle: (kind: string) => void;
  clear: () => void;
}

export const usePinnedMarketStore = create<PinnedMarketState>()(
  persist(
    (set) => ({
      kinds: [],
      toggle: (kind) => {
        set((state) => ({
          kinds: state.kinds.includes(kind)
            ? state.kinds.filter((k) => k !== kind)
            : [...state.kinds, kind],
        }));
      },
      clear: () => {
        set({ kinds: [] });
      },
    }),
    { name: "betng.pinned-markets" },
  ),
);
