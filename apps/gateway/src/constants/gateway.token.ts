import { createToken } from "@zudojs/container";
import type { Logger } from "@betng/service-kit";
import type { UpstreamClients } from "../interfaces/index.js";

export const UPSTREAM_CLIENTS_TOKEN =
  createToken<UpstreamClients>("gateway.upstreamClients");

export const LOGGER_TOKEN = createToken<Logger>("gateway.logger");
