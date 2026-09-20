import type { Container } from "@zudojs/container";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import {
  CHANNEL_REGISTRY_TOKEN,
  EVENT_COMMAND,
  EVENT_QUERY,
  LOGGER_TOKEN,
} from "../../constants/index.js";
import { PublishEventHandler } from "./commands/index.js";
import { GetChannelStateHandler } from "./queries/index.js";

export interface EventServiceConfig {
  readonly container: Container;
  readonly commandBus: CommandBus;
  readonly queryBus: QueryBus;
}

export function registerEventService(config: EventServiceConfig): void {
  const { container, commandBus, queryBus } = config;

  const channels = container.resolve(CHANNEL_REGISTRY_TOKEN);
  const logger = container.resolve(LOGGER_TOKEN);

  commandBus.register(
    EVENT_COMMAND.PUBLISH_EVENT,
    new PublishEventHandler(channels, logger),
  );

  queryBus.register(
    EVENT_QUERY.GET_CHANNEL_STATE,
    new GetChannelStateHandler(channels),
  );
}
