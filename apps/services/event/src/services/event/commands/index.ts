/**
 * The write side of the event service. Reachable only from inside the
 * platform: a client is a consumer and has no frame that publishes.
 */

export {
  PublishEventCommand,
  PublishEventHandler,
} from "./publishEvent/index.js";
export type { PublishResult } from "./publishEvent/index.js";
export {
  PublishSignalCommand,
  PublishSignalHandler,
} from "./publishSignal/index.js";
export type { SignalResult, SignalType } from "./publishSignal/index.js";
