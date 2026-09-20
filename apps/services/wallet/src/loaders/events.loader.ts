import { createEventBus } from "@zudojs/events";
import type { EventBus } from "@zudojs/events";
import type { Logger } from "@betng/service-kit";
import { LedgerEntryAppendedEvent } from "../events/index.js";

export function loadEvents(logger: Logger): EventBus {
  const events = createEventBus();

  events.register(LedgerEntryAppendedEvent);
  events.start();

  logger.debug("Event definitions registered", {
    events: [LedgerEntryAppendedEvent.type],
  });

  return events;
}
