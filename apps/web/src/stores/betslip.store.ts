import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  STAKE_LIMITS,
  removeSelection,
  toggleSelection,
  type SlipSelection,
} from "@betng/ui-core";

export interface OddsChange {
  readonly selectionId: string;
  readonly odds: number;
}

interface BetSlipState {
  readonly selections: readonly SlipSelection[];
  readonly stake: number;
  readonly open: boolean;
  /** The reference of a submission whose outcome is unknown. Any change to the slip starts a new attempt. */
  readonly pendingReference: string | undefined;
  toggle: (selection: SlipSelection) => void;
  remove: (selectionId: string) => void;
  removeMany: (selectionIds: readonly string[]) => void;
  acceptOdds: (changes: readonly OddsChange[]) => void;
  clear: () => void;
  setStake: (stake: number) => void;
  setOpen: (open: boolean) => void;
  setPendingReference: (reference: string | undefined) => void;
}

export const BETSLIP_STORAGE_KEY = "betng.betslip";

export const useBetSlip = create<BetSlipState>()(
  persist(
    (set) => ({
      selections: [],
      stake: STAKE_LIMITS.default,
      open: false,
      pendingReference: undefined,
      toggle: (selection) => {
        set((state) => ({
          selections: toggleSelection(state.selections, selection),
          pendingReference: undefined,
        }));
      },
      remove: (selectionId) => {
        set((state) => ({
          selections: removeSelection(state.selections, selectionId),
          pendingReference: undefined,
        }));
      },
      removeMany: (selectionIds) => {
        set((state) => ({
          selections: state.selections.filter(
            (s) => !selectionIds.includes(s.selectionId),
          ),
          pendingReference: undefined,
        }));
      },
      acceptOdds: (changes) => {
        set((state) => ({
          selections: state.selections.map((s) => {
            const change = changes.find((c) => c.selectionId === s.selectionId);

            return change === undefined ? s : { ...s, odds: change.odds };
          }),
          pendingReference: undefined,
        }));
      },
      clear: () => {
        set({ selections: [], pendingReference: undefined });
      },
      setStake: (stake) => {
        set((state) =>
          state.stake === stake ? state : { stake, pendingReference: undefined },
        );
      },
      setOpen: (open) => {
        set({ open });
      },
      setPendingReference: (pendingReference) => {
        set({ pendingReference });
      },
    }),
    {
      name: BETSLIP_STORAGE_KEY,
      partialize: (state) => ({
        selections: state.selections,
        stake: state.stake,
        pendingReference: state.pendingReference,
      }),
    },
  ),
);
