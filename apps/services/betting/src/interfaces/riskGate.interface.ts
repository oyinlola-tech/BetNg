/**
 * The risk gate: what betting asks before accepting a slip.
 *
 * The platform controls its book by repricing or suspending a market *while
 * betting is still open* — never by touching a result after the fact. This
 * interface is where that happens, and it is deliberately the only channel
 * betting has to risk.
 *
 * What it returns is an action, not a result: accept, review, or suspend the
 * market. Risk cannot alter a bet, a price or a match outcome; see
 * `docs/architecture.md`.
 */

import type { BetSelection } from "@betng/contracts";

/** What the gate decided about a slip. */
export interface RiskDecision {
  /** Whether the slip may be accepted. */
  readonly accepted: boolean;
  /** Why, in terms a log or a client message can use. */
  readonly reason: string;
  /**
   * Whether risk actually assessed the slip.
   *
   * False when the risk model is not built yet and the gate degraded open.
   * Recorded so "accepted" is never mistaken for "assessed and approved".
   */
  readonly assessed: boolean;
}

export interface RiskGate {
  /**
   * Asks risk whether a slip may be accepted.
   *
   * @param selections - The legs being backed.
   * @param stake - The simulated stake in minor units.
   * @param requestId - The correlation identifier to carry across the hop.
   */
  evaluate(
    selections: readonly BetSelection[],
    stake: number,
    requestId: string,
  ): Promise<RiskDecision>;
}
