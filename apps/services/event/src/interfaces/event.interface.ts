/**
 * The event service's subscription contract.
 *
 * A channel is a match: `match:{matchId}`. A registry tracks who is listening
 * to what, and what the last published sequence on each channel was.
 *
 * The registry is in-process, which bounds the service to one instance
 * serving a given subscriber. Fanning out across instances means putting a
 * shared channel behind this interface — Redis pub/sub is why `REDIS_URL` is
 * already configured. Nothing above this file changes when that lands.
 */

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
