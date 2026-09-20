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

export const clientFrameSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("SUBSCRIBE"),
    channel: z.string().min(1).max(128),
  }),
  z.object({
    type: z.literal("UNSUBSCRIBE"),
    channel: z.string().min(1).max(128),
  }),
  z.object({ type: z.literal("PONG") }),
]);

export type ClientFrame = z.infer<typeof clientFrameSchema>;

export interface WelcomeFrame {
  readonly type: "WELCOME";
  readonly connectionId: string;
  readonly serverTime: string;
}

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

export interface EventFrame {
  readonly type: "EVENT";
  readonly channel: string;
  readonly event: z.infer<typeof liveEventSchema>;
}

export interface PingFrame {
  readonly type: "PING";
  readonly serverTime: string;
}

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
