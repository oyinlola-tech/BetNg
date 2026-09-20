import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
        set((s) => ({ selections: toggleSelection(s.selections, selection) }));
      },
      remove: (id) => {
        set((s) => ({ selections: removeSelection(s.selections, id) }));
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
      name: "betng.mobile.betslip",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ selections: s.selections, stake: s.stake }),
    },
  ),
);
