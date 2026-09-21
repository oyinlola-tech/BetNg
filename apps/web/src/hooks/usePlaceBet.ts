import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { BetPlacementView } from "@betng/ui-core";
import { keys } from "../lib/queryKeys";
import { placeBet, type PlaceBetRequest } from "../services/bets.service";

const PLACED: ReadonlySet<BetPlacementView["outcome"]> = new Set([
  "ACCEPTED",
  "LIMITED",
  "PARTIALLY_ACCEPTED",
]);

export interface PlaceBetCallbacks {
  readonly onStart?: (request: PlaceBetRequest) => void;
  readonly onPlacement?: (
    placement: BetPlacementView,
    request: PlaceBetRequest,
  ) => void;
  readonly onFailure?: (error: unknown, request: PlaceBetRequest) => void;
}

/** Callbacks run from the mutation itself, so they still fire when the caller has unmounted. */
export function usePlaceBet(callbacks: PlaceBetCallbacks = {}) {
  const client = useQueryClient();

  return useMutation<BetPlacementView, unknown, PlaceBetRequest>({
    mutationFn: placeBet,
    retry: false,
    onMutate: (request) => {
      callbacks.onStart?.(request);
    },
    onSuccess: (placement, request) => {
      if (PLACED.has(placement.outcome)) {
        void client.invalidateQueries({ queryKey: keys.wallet });
        void client.invalidateQueries({ queryKey: keys.bets });
        void client.invalidateQueries({ queryKey: keys.transactionsRoot });
      }

      callbacks.onPlacement?.(placement, request);
    },
    onError: (error, request) => {
      callbacks.onFailure?.(error, request);
    },
  });
}
