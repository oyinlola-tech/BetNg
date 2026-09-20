/**
 * @betng/service-kit/serviceConfig
 *
 * Environment-backed configuration, loaded through `@zudojs/config`.
 */

export {
  DEFAULT_PORTS,
  DEFAULT_SERVICE_TIMEOUT_MS,
  SERVICE_NAMES,
} from "./serviceConfig.type.js";
export type {
  Environment,
  LoadServiceConfigOptions,
  ServiceConfig,
  ServiceEndpoint,
  ServiceName,
} from "./serviceConfig.type.js";

export { loadServiceConfig } from "./serviceConfig.loader.js";
