/**
 * @betng/gateway
 *
 * The external API entry point: routing, API versioning and service access.
 */

export { createApp } from "./app.js";
export type { GatewayApp } from "./app.js";
export {
  DEFAULT_PORT,
  loadGatewayConfig,
  SERVICE_NAME,
  SERVICE_VERSION,
} from "./configs/index.js";
