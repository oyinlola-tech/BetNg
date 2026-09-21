import { z } from "@zudojs/validation";
import type { liveEventSchema } from "./liveEvent.type.js";

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
