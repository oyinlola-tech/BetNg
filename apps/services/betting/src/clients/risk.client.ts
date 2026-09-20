/**
 * The betting service's RPC client for the risk service.
 *
 * Betting calls risk while a market is still open, to learn what the book is
 * carrying. That call is a typed computation with a deadline, not a resource
 * to browse — and risk must never be reachable from a public client, so RPC
 * rather than a gateway-forwarded REST route.
 *
 * The answer is advisory. Risk reports an action; deciding what to do about
 * it belongs to betting. Risk cannot alter a bet, a price or a result.
 */

import { createRpcClient } from "@betng/service-kit";
import type { ServiceEndpoint } from "@betng/service-kit";
import { createRPCMetadata, RPCClient } from "@zudojs/rpc";

/** The procedures the risk service answers. */
export const RISK_PROCEDURE = Object.freeze({
  CALCULATE_EXPOSURE: "risk.calculateExposure",
  CALCULATE_LIABILITY: "risk.calculateLiability",
});

/** What the risk service is told about a market. */
export interface ExposureRequest {
  readonly matchId: string;
  readonly marketId: string;
  readonly selections: readonly {
    readonly selectionId: string;
    readonly stake: number;
    readonly liability: number;
  }[];
  readonly currency: string;
}

/** What the risk service reports back. */
export interface ExposureReport {
  readonly matchId: string;
  readonly marketId: string;
  readonly worstCaseLiability: number;
  readonly worstCaseSelectionId: string;
  readonly totalStake: number;
  readonly currency: string;
  readonly action: "ACCEPT" | "REVIEW" | "SUSPEND_MARKET";
  readonly evaluatedAt: string;
}

/** A typed façade over the raw RPC client. */
export interface RiskClient {
  readonly calculateExposure: (
    request: ExposureRequest,
    requestId: string,
  ) => Promise<ExposureReport>;
  readonly raw: RPCClient;
}

/**
 * Creates the risk client.
 *
 * @param endpoint - The risk service's address, from configuration.
 * @returns A typed client.
 */
export function createRiskClient(endpoint: ServiceEndpoint): RiskClient {
  const client = createRpcClient(endpoint);

  return {
    raw: client,
    calculateExposure: async (request, requestId) =>
      client.call<ExposureRequest, ExposureReport>(
        RISK_PROCEDURE.CALCULATE_EXPOSURE,
        request,
        { metadata: createRPCMetadata({ requestId }) },
      ),
  };
}
