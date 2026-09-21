import {
  DataSourceError,
  createClientReference,
  type BetPlacementView,
  type DataSourceErrorCode,
  type SlipSelection,
} from "@betng/ui-core";
import { useBetSlip } from "../stores/betslip.store";
import { dataSource, logger } from "./runtime";

export interface PlaceBetRequest {
  readonly selections: readonly SlipSelection[];
  readonly stake: number;
}

/* Failures that leave the outcome unknown: the same attempt may be sent again under the same reference. */
const OUTCOME_UNKNOWN: ReadonlySet<DataSourceErrorCode> = new Set([
  "NETWORK",
  "OFFLINE",
  "TIMEOUT",
  "UNAVAILABLE",
  "SERVER",
]);

export function isRetryableSubmission(error: unknown): boolean {
  return error instanceof DataSourceError && OUTCOME_UNKNOWN.has(error.code);
}

export async function placeBet({
  selections,
  stake,
}: PlaceBetRequest): Promise<BetPlacementView> {
  const slip = useBetSlip.getState();
  const clientReference = slip.pendingReference ?? createClientReference();

  if (slip.pendingReference === undefined)
    slip.setPendingReference(clientReference);

  try {
    const placement = await dataSource.placeBet({
      selections,
      stake,
      clientReference,
    });

    useBetSlip.getState().setPendingReference(undefined);

    if (placement.outcome === "REJECTED" || placement.outcome === "EXPIRED") {
      logger.info("flow", "Bet submission was not accepted", {
        outcome: placement.outcome,
        reason: placement.reason,
        selections: selections.length,
      });
    }

    return placement;
  } catch (cause) {
    const retryable = isRetryableSubmission(cause);

    if (!retryable) useBetSlip.getState().setPendingReference(undefined);

    logger.warn("flow", "Bet submission failed", {
      code: cause instanceof DataSourceError ? cause.code : "UNKNOWN",
      requestId:
        cause instanceof DataSourceError ? cause.detail.requestId : undefined,
      retryable,
      selections: selections.length,
    });

    throw cause;
  }
}
