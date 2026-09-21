import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  STAKE_LIMITS,
  removeSelection,
  toggleSelection,
  type SlipSelection,
} from "@betng/ui-core";

interface BetSlipState {
  readonly selections: readonly SlipSelection[];
  readonly stake: number;
  readonly open: boolean;
  toggle: (selection: SlipSelection) => void;
  remove: (selectionId: string) => void;
  removeMany: (selectionIds: readonly string[]) => void;
  acceptOdds: (changes: readonly { readonly selectionId: string; readonly odds: number }[]) => void;
  clear: () => void;
  setStake: (stake: number) => void;
  setOpen: (open: boolean) => void;
}

export const useBetSlip = create<BetSlipState>()(
  persist(
    (set) => ({
      selections: [],
      stake: STAKE_LIMITS.default,
      open: false,
      toggle: (selection) => {
        set((state) => ({
          selections: toggleSelection(state.selections, selection),
        }));
      },
      remove: (selectionId) => {
        set((state) => ({
          selections: removeSelection(state.selections, selectionId),
        }));
      },
      removeMany: (selectionIds) => {
        set((state) => ({
          selections: state.selections.filter((s) => !selectionIds.includes(s.selectionId)),
        }));
      },
      acceptOdds: (changes) => {
        set((state) => ({
          selections: state.selections.map((s) => {
            const change = changes.find((c) => c.selectionId === s.selectionId);

            return change === undefined ? s : { ...s, odds: change.odds };
          }),
        }));
      },
      clear: () => {
        set({ selections: [] });
      },
      setStake: (stake) => {
        set({ stake });
      },
      setOpen: (open) => {
        set({ open });
      },
    }),
    {
      name: "betng.betslip",
      partialize: (state) => ({
        selections: state.selections,
        stake: state.stake,
      }),
    },
  ),
);
