import { create } from "zustand";
import type { BetPlacementView } from "@betng/ui-core";

export type SlipOutcome =
  | {
      readonly kind: "PLACED";
      readonly placement: BetPlacementView;
      readonly requestedStake: number;
    }
  | { readonly kind: "REFUSED"; readonly placement: BetPlacementView }
  | { readonly kind: "EXPIRED"; readonly placement: BetPlacementView }
  | { readonly kind: "FAILED"; readonly error: unknown; readonly retryable: boolean };

interface SlipOutcomeState {
  readonly submitting: boolean;
  readonly outcome: SlipOutcome | undefined;
  setSubmitting: (submitting: boolean) => void;
  setOutcome: (outcome: SlipOutcome | undefined) => void;
}

/* Held outside the component so a result still lands when the sheet was closed mid-submission. Never persisted. */
export const useSlipOutcome = create<SlipOutcomeState>()((set) => ({
  submitting: false,
  outcome: undefined,
  setSubmitting: (submitting) => {
    set({ submitting });
  },
  setOutcome: (outcome) => {
    set({ outcome });
  },
}));
