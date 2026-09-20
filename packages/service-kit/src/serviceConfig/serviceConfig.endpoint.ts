/**
 * Resolution of peer-service addresses.
 *
 * Every service learns where every other service lives from the
 * environment. Nothing in application logic may hard-code a host or a port.
 */

import type { ConfigManager } from "@zudojs/config";
import { ConfigurationError } from "@zudojs/errors";
import type { ServiceEndpoint, ServiceName } from "./serviceConfig.type.js";
import { DEFAULT_PORTS, SERVICE_NAMES } from "./serviceConfig.type.js";
import { configKey } from "./serviceConfig.reader.js";

/**
 * Reads every `<SERVICE>_SERVICE_URL`.
 *
 * A malformed URL is rejected here, so it surfaces as a startup failure
 * rather than as a confusing fetch error on the first request that needs
 * the peer.
 *
 * @param manager - The loaded configuration manager.
 * @param timeoutMs - The call timeout applied to every peer.
 * @returns Every peer endpoint, keyed by service name.
 */
export function readEndpoints(
  manager: ConfigManager,
  timeoutMs: number,
): Readonly<Record<ServiceName, ServiceEndpoint>> {
  const entries = SERVICE_NAMES.map((name): [ServiceName, ServiceEndpoint] => {
    const url =
      manager.string(configKey(`${name.toUpperCase()}_SERVICE_URL`)) ??
      `http://localhost:${String(DEFAULT_PORTS[name])}`;

    try {
      void new URL(url);
    } catch {
      throw new ConfigurationError(
        `${name.toUpperCase()}_SERVICE_URL is not a valid URL: "${url}".`,
      );
    }

    return [name, Object.freeze({ name, url, timeoutMs })];
  });

  return Object.freeze(Object.fromEntries(entries)) as Readonly<
    Record<ServiceName, ServiceEndpoint>
  >;
}
