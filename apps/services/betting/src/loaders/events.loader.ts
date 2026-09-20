/**
 * Registers the betting service's event definitions and starts the bus.
 *
 * Registering a definition up front means publishing an unknown event type
 * is a startup-time mistake rather than a silent no-op at runtime.
 */

import { createEventBus } from "@zudojs/events";
import type { EventBus } from "@zudojs/events";
import type { Logger } from "@betng/service-kit";
import { BetPlacedEvent } from "../events/index.js";

export function loadEvents(logger: Logger): EventBus {
  const events = createEventBus();

  events.register(BetPlacedEvent);
  events.start();

  logger.debug("Event definitions registered", {
    events: [BetPlacedEvent.type],
  });

  return events;
}
