/**
 * The WebSocket protocol the event service speaks.
 *
 * Deliberately tiny. A client may subscribe, unsubscribe and answer a
 * heartbeat; it may not publish. Match events are produced by the simulation
 * and relayed by the platform, so a client that could publish could forge a
 * goal — the protocol simply has no frame for it.
 */

import { z } from "@zudojs/validation";
import { liveEventSchema } from "./liveEvent.type.js";

/* -------------------------------------------------------------------------- */
/* Client → server                                                            */
/* -------------------------------------------------------------------------- */

export const clientFrameSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("SUBSCRIBE"),
    /** A channel name, e.g. `match:44444444-4444-4444-8444-444444444444`. */
    channel: z.string().min(1).max(128),
  }),
  z.object({
    type: z.literal("UNSUBSCRIBE"),
    channel: z.string().min(1).max(128),
  }),
  z.object({ type: z.literal("PONG") }),
]);

export type ClientFrame = z.infer<typeof clientFrameSchema>;

/* -------------------------------------------------------------------------- */
/* Server → client                                                            */
/* -------------------------------------------------------------------------- */

/** Sent once on connect, so a client knows its own identity for support. */
export interface WelcomeFrame {
  readonly type: "WELCOME";
  readonly connectionId: string;
  readonly serverTime: string;
}

/** Confirms a subscription and states where the stream is picking up. */
export interface SubscribedFrame {
  readonly type: "SUBSCRIBED";
  readonly channel: string;
  /**
   * The last sequence the server has published on this channel, or 0 when
   * nothing has been published yet. A client that joins mid-match reads the
   * match's current state over REST and knows which frames it already has.
   */
  readonly lastSequence: number;
}

export interface UnsubscribedFrame {
  readonly type: "UNSUBSCRIBED";
  readonly channel: string;
}

/** One live match event. */
export interface EventFrame {
  readonly type: "EVENT";
  readonly channel: string;
  readonly event: z.infer<typeof liveEventSchema>;
}

/** Keeps an idle connection alive and detects a half-open socket. */
export interface PingFrame {
  readonly type: "PING";
  readonly serverTime: string;
}

/**
 * A protocol-level failure.
 *
 * Carries the same `code` vocabulary as the REST envelope, so a client
 * handles "that channel does not exist" the same way whichever transport
 * told it.
 */
export interface ErrorFrame {
  readonly type: "ERROR";
  readonly code: string;
  readonly message: string;
}

export type ServerFrame =
  | WelcomeFrame
  | SubscribedFrame
  | UnsubscribedFrame
  | EventFrame
  | PingFrame
  | ErrorFrame;
