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

/** What a channel looks like to a caller. */
export interface ChannelState {
  readonly channel: string;
  /** The last sequence published here; 0 when nothing has been. */
  readonly lastSequence: number;
  readonly subscribers: number;
}

export interface ChannelRegistry {
  /** Records a connection so it can be addressed and cleaned up. */
  open(session: WebSocketSession): void;
  /** Forgets a connection and every subscription it held. */
  close(session: WebSocketSession): void;
  /** Subscribes a connection to a channel. Idempotent. */
  subscribe(session: WebSocketSession, channel: string): ChannelState;
  /** Unsubscribes a connection from a channel. Idempotent. */
  unsubscribe(session: WebSocketSession, channel: string): void;
  /** Every session currently subscribed to a channel. */
  subscribers(channel: string): readonly WebSocketSession[];
  /** Reads a channel without subscribing to it. */
  state(channel: string): ChannelState;
  /**
   * Assigns the next sequence on a channel.
   *
   * Sequences are assigned here, not by the publisher, so two publishers
   * cannot hand out the same number and a client's gap detection stays
   * meaningful.
   */
  nextSequence(channel: string): number;
  /** Records that a connection answered its heartbeat. */
  markAlive(session: WebSocketSession): void;
  /** Sessions that have not answered a heartbeat within the timeout. */
  stale(timeoutMs: number): readonly WebSocketSession[];
  /** Every open connection. */
  connections(): readonly WebSocketSession[];
}

export type { ChannelState as Channel, LiveEvent };
