import { useCallback } from "react";
import { DataSourceError, type BetPlacementView } from "@betng/ui-core";
import { usePlaceBet } from "../../hooks/usePlaceBet";
import { analytics, legsBucket } from "../../services/analytics";
import { isRetryableSubmission, type PlaceBetRequest } from "../../services/bets.service";
import { useBetSlip } from "../../stores/betslip.store";
import { INTENT_REASONS, useAuthDialog } from "../auth/auth.store";
import { useAuth } from "../auth/useAuth";
import { useSlipOutcome } from "./outcome.store";

function settleDraft(placement: BetPlacementView): void {
  const slip = useBetSlip.getState();
  const rejected = placement.rejectedSelectionIds ?? [];

  if (placement.outcome === "PARTIALLY_ACCEPTED" && rejected.length > 0) {
    slip.removeMany(
      slip.selections
        .map((s) => s.selectionId)
        .filter((id) => !rejected.some((r) => r === id)),
    );

    return;
  }

  slip.clear();
}

function isSessionFailure(error: unknown): boolean {
  return (
    error instanceof DataSourceError &&
    (error.code === "SESSION_EXPIRED" || error.code === "UNAUTHENTICATED")
  );
}

export interface SlipSubmission {
  readonly submitting: boolean;
  /** Asks for sign-in first when needed; the slip is kept and the submission resumes afterwards. */
  readonly submit: () => void;
}

export function useSlipSubmission(): SlipSubmission {
  const { requireAuth } = useAuth();
  const submitting = useSlipOutcome((s) => s.submitting);

  const { mutate } = usePlaceBet({
    onStart: () => {
      useSlipOutcome.setState({ submitting: true, outcome: undefined });
    },
    onPlacement: (placement, request: PlaceBetRequest) => {
      const { outcome } = placement;

      analytics.track(outcome === "REJECTED" || outcome === "EXPIRED" ? "bet_refused" : "bet_accepted", { outcome: outcome.toLowerCase(), legs: legsBucket(request.selections.length) });

      if (outcome === "REJECTED") {
        useSlipOutcome.setState({ submitting: false, outcome: { kind: "REFUSED", placement } });
      } else if (outcome === "EXPIRED") {
        useSlipOutcome.setState({ submitting: false, outcome: { kind: "EXPIRED", placement } });
      } else {
        settleDraft(placement);
        useSlipOutcome.setState({
          submitting: false,
          outcome: { kind: "PLACED", placement, requestedStake: request.stake },
        });
      }
    },
    onFailure: (error) => {
      if (isSessionFailure(error)) {
        useSlipOutcome.setState({ submitting: false, outcome: undefined });
        useAuthDialog.getState().show("expired", {
          reason: INTENT_REASONS["place-bet"],
          run: send,
        });

        return;
      }

      useSlipOutcome.setState({
        submitting: false,
        outcome: { kind: "FAILED", error, retryable: isRetryableSubmission(error) },
      });
    },
  });

  const send = useCallback((): void => {
    const slip = useBetSlip.getState();

    if (slip.selections.length === 0 || useSlipOutcome.getState().submitting) return;

    analytics.track("bet_submitted", { legs: legsBucket(slip.selections.length) });
    mutate({ selections: slip.selections, stake: slip.stake });
  }, [mutate]);

  const submit = useCallback((): void => {
    requireAuth("place-bet", send);
  }, [requireAuth, send]);

  return { submitting, submit };
}
