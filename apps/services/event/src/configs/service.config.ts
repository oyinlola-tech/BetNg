import { loadServiceConfig } from "@betng/service-kit";
import type { ServiceConfig } from "@betng/service-kit";

export const SERVICE_NAME = "event" as const;

export const SERVICE_VERSION = "0.1.0";

export const DEFAULT_PORT = 3008;

export const LIVE_PATH = "/live";

export async function loadEventConfig(
  env?: Readonly<Record<string, string | undefined>>,
): Promise<ServiceConfig> {
  return loadServiceConfig({
    serviceName: SERVICE_NAME,
    version: SERVICE_VERSION,
    defaultPort: DEFAULT_PORT,
    usesRedis: true,
    ...(env === undefined ? {} : { env }),
  });
}
