/**
 * The gateway's dependency-injection tokens.
 */

import { createToken } from "@zudojs/container";
import type { Logger } from "@betng/service-kit";
import type { UpstreamClients } from "../interfaces/index.js";

/** Resolves the clients for every service the gateway forwards to. */
export const UPSTREAM_CLIENTS_TOKEN =
  createToken<UpstreamClients>("gateway.upstreamClients");

/** Resolves the root logger. */
export const LOGGER_TOKEN = createToken<Logger>("gateway.logger");
