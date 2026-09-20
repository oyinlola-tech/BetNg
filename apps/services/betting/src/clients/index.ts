/**
 * The RPC clients betting uses to reach its internal peers.
 *
 * Both are RPC because both calls sit on the bet-placement path and both
 * peers are internal: a public client must never reach risk, and an odds
 * lookup wants a deadline rather than a resource URL. See `docs/api/rpc.md`.
 */

export { createRiskClient, RISK_PROCEDURE } from "./risk.client.js";
export type {
  ExposureReport,
  ExposureRequest,
  RiskClient,
} from "./risk.client.js";

export { createRpcRiskGate } from "./riskGate.client.js";

export { createOddsClient, ODDS_PROCEDURE } from "./odds.client.js";
export type { MatchOdds, OddsClient, Selection } from "./odds.client.js";
