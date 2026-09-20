import { createQueryBus } from "@zudojs/cqrs";
import type { QueryBus } from "@zudojs/cqrs";
import type { Container } from "@zudojs/container";
import { LOGGER_TOKEN } from "../constants/index.js";
import { registerSettlementService } from "../services/index.js";

export function loadServices(container: Container): QueryBus {
  const queryBus = createQueryBus();

  registerSettlementService({ container, queryBus });

  container.resolve(LOGGER_TOKEN).debug("Query handlers registered", {
    handlers: queryBus.size(),
  });

  return queryBus;
}
