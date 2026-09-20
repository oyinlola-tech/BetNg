/**
 * @betng/contracts/realtime
 *
 * The live match stream: what the event service pushes, and the protocol it
 * speaks. The stream is a projection of the simulation's decisions, never the
 * source of truth.
 */

export {
  liveEventSchema,
  liveEventTypeSchema,
  MATCH_CHANNEL_PATTERN,
  matchChannel,
} from "./liveEvent.type.js";
export type { LiveEvent, LiveEventType } from "./liveEvent.type.js";

export { clientFrameSchema } from "./liveProtocol.type.js";
export type {
  ClientFrame,
  ErrorFrame,
  EventFrame,
  PingFrame,
  ServerFrame,
  SubscribedFrame,
  UnsubscribedFrame,
  WelcomeFrame,
} from "./liveProtocol.type.js";
