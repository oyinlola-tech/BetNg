import { createToken } from "@zudojs/container";
import type { Logger } from "@betng/service-kit";
import type { ChannelRegistry } from "../interfaces/index.js";

export const CHANNEL_REGISTRY_TOKEN =
  createToken<ChannelRegistry>("event.channelRegistry");

export const LOGGER_TOKEN = createToken<Logger>("event.logger");
