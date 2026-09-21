import type {
  LiveEventType,
  MatchSide,
  RunMatchRequest,
  RunMatchResponse,
  TeamStrength,
} from "@betng/contracts";

export type MarketsStatus = "OPEN" | "CLOSED" | "SETTLED" | "VOID";

export interface PublishMarketsResult {
  readonly matchId: string;
  readonly markets: number;
  readonly oddsVersion: number;
}

export interface OddsPeer {
  publishMarkets(
    input: {
      readonly matchId: string;
      readonly home: TeamStrength;
      readonly away: TeamStrength;
    },
    requestId: string,
  ): Promise<PublishMarketsResult>;
  setMatchMarketsStatus(
    matchId: string,
    status: MarketsStatus,
    requestId: string,
  ): Promise<{ readonly updated: number }>;
}

export interface SimulationPeer {
  runMatch(
    request: RunMatchRequest,
    requestId: string,
  ): Promise<RunMatchResponse>;
}

export interface RiskPeer {
  freezeExposure(
    matchId: string,
    requestId: string,
  ): Promise<{ readonly matchId: string; readonly frozenAt: string }>;
}

export interface MatchSettlementResult {
  readonly matchId: string;
  readonly status: string;
  readonly betsTotal: number;
  readonly betsSettled: number;
  readonly duplicate: boolean;
}

export interface SettlementPeer {
  settleMatch(
    matchId: string,
    requestId: string,
  ): Promise<MatchSettlementResult>;
  voidMatch(
    matchId: string,
    reason: string,
    requestId: string,
  ): Promise<MatchSettlementResult>;
}

export interface LiveEventInput {
  readonly matchId: string;
  readonly type: LiveEventType;
  readonly minute: number;
  readonly side?: MatchSide;
  readonly score: { readonly home: number; readonly away: number };
  readonly description: string;
}

export interface EventPeer {
  publish(
    event: LiveEventInput,
    requestId: string,
  ): Promise<{ readonly sequence: number }>;
}

export interface AuditInput {
  readonly actorId: string;
  readonly actorRole: string;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly before?: unknown;
  readonly after?: unknown;
  readonly reason?: string;
  readonly severity?: "INFO" | "NOTICE" | "WARNING" | "CRITICAL";
  readonly requestId: string;
}

export interface IdentityPeer {
  recordAudit(entry: AuditInput): Promise<{ readonly id: string }>;
}

export interface Peers {
  readonly odds: OddsPeer;
  readonly simulation: SimulationPeer;
  readonly risk: RiskPeer;
  readonly settlement: SettlementPeer;
  readonly event: EventPeer;
  readonly identity: IdentityPeer;
}
