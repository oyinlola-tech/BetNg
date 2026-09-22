/** "Re-read your bets" signals carrying only the bet id; best effort, never awaited by a placement. */
export interface BetSignalPublisher {
  betAccepted(customerId: string, betId: string, requestId: string): void;
}
