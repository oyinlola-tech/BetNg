import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { STAKE_LIMITS, removeSelection, toggleSelection, type SlipSelection } from "@betng/ui-core";

interface SlipState {
  readonly selections: readonly SlipSelection[];
  readonly stake: number;
  readonly customerName: string;
  readonly customerPhone: string;
  readonly open: boolean;
  toggle: (selection: SlipSelection) => void;
  remove: (selectionId: string) => void;
  reprice: (prices: ReadonlyMap<string, number>) => void;
  clear: () => void;
  setStake: (stake: number) => void;
  setCustomer: (patch: { readonly customerName?: string; readonly customerPhone?: string }) => void;
  setOpen: (open: boolean) => void;
}

export const useSlip = create<SlipState>()(
  persist(
    (set) => ({
      selections: [],
      stake: STAKE_LIMITS.default,
      customerName: "",
      customerPhone: "",
      open: false,
      toggle: (selection) => {
        set((state) => ({ selections: toggleSelection(state.selections, selection) }));
      },
      remove: (selectionId) => {
        set((state) => ({ selections: removeSelection(state.selections, selectionId) }));
      },
      reprice: (prices) => {
        set((state) => ({ selections: state.selections.map((s) => ({ ...s, odds: prices.get(s.selectionId) ?? s.odds })) }));
      },
      clear: () => {
        set({ selections: [], customerName: "", customerPhone: "" });
      },
      setStake: (stake) => {
        set({ stake });
      },
      setCustomer: (patch) => {
        set(patch);
      },
      setOpen: (open) => {
        set({ open });
      },
    }),
    {
      name: "betng.shop.slip",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ selections: state.selections, stake: state.stake, customerName: state.customerName, customerPhone: state.customerPhone }),
    },
  ),
);
