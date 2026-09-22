import type { LiveEvent, WebSocketSession } from "./event.types.js";

export interface ChannelState {
  readonly channel: string;
  readonly lastSequence: number;
  readonly subscribers: number;
}

export interface ChannelRegistry {
  open(session: WebSocketSession): void;
  close(session: WebSocketSession): void;
  subscribe(session: WebSocketSession, channel: string): ChannelState;
  unsubscribe(session: WebSocketSession, channel: string): void;
  subscribers(channel: string): readonly WebSocketSession[];
  subscriptions(session: WebSocketSession): readonly string[];
  state(channel: string): ChannelState;
  /**
   * Assigns the next sequence on a channel.
   *
   * Sequences are assigned here, not by the publisher, so two publishers
   * cannot hand out the same number and a client's gap detection stays
   * meaningful.
   */
  nextSequence(channel: string): number;
  markAlive(session: WebSocketSession): void;
  stale(timeoutMs: number): readonly WebSocketSession[];
  connections(): readonly WebSocketSession[];
}

export type { ChannelState as Channel, LiveEvent };
