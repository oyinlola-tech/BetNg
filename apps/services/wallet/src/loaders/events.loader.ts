/**
 * Registers the wallet service's event definitions and starts the bus.
 *
 * Registering a definition up front means publishing an unknown event type
 * is a startup-time mistake rather than a silent no-op at runtime.
 */

import { createEventBus } from "@zudojs/events";
import type { EventBus } from "@zudojs/events";
import type { Logger } from "@betng/service-kit";
import { LedgerEntryAppendedEvent } from "../events/index.js";

/**
 * Builds the event bus with every wallet event registered.
 *
 * @param logger - The logger to report registration through.
 * @returns The started event bus.
 */
export function loadEvents(logger: Logger): EventBus {
  const events = createEventBus();

  events.register(LedgerEntryAppendedEvent);
  events.start();

  logger.debug("Event definitions registered", {
    events: [LedgerEntryAppendedEvent.type],
  });

  return events;
}
