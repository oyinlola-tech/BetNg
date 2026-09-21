import type { LiveEventType } from "@betng/contracts";

export type RealtimeEventType =
  | LiveEventType
  | "MATCH_UPDATED"
  | "MATCH_EVENT"
  | "CARD"
  | "MARKET_UPDATED"
  | "BET_UPDATED"
  | "WALLET_UPDATED"
  | "NOTIFICATION_CREATED"
  | "SYSTEM_STATUS_UPDATED";

export interface RealtimeEvent<P = unknown> {
  readonly type: RealtimeEventType;
  readonly channel: string;
  readonly id?: string;
  readonly sequence?: number;
  readonly version?: number;
  readonly timestamp?: string;
  readonly payload: P;
}

export type ConnectionStatus =
  "CONNECTING" | "CONNECTED" | "RECONNECTING" | "DISCONNECTED" | "FAILED";

export interface TransportHandlers {
  readonly onOpen: () => void;
  readonly onClose: () => void;
  readonly onMessage: (data: unknown) => void;
}

export interface TransportConnection {
  readonly send: (frame: unknown) => void;
  readonly close: () => void;
  /** False when the transport carries subscriptions in its URL and must be reopened to change them. */
  readonly duplex: boolean;
}

export type RealtimeTransport = (
  url: string,
  handlers: TransportHandlers,
  channels: readonly string[],
) => TransportConnection;

export type RealtimeAuthMode = "none" | "frame" | "query";

export const accountChannel = (userId: string): string => `user:${userId}`;
export const SYSTEM_CHANNEL = "system";
