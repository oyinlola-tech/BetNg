/**
 * The event service's dependency-injection tokens.
 */

import { createToken } from "@zudojs/container";
import type { Logger } from "@betng/service-kit";
import type { ChannelRegistry } from "../interfaces/index.js";

/** Resolves the registry of channels and their subscribers. */
export const CHANNEL_REGISTRY_TOKEN =
  createToken<ChannelRegistry>("event.channelRegistry");

/** Resolves the root logger. */
export const LOGGER_TOKEN = createToken<Logger>("event.logger");
