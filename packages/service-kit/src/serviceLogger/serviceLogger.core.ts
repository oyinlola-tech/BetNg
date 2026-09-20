/**
 * Structured logging, built on `@zudojs/logger`.
 *
 * Every log line is one JSON object carrying the timestamp, level, service
 * name and message. A request-scoped line additionally carries `requestId`,
 * which is how one request is followed across services.
 */

import { createJsonLoggerFormatter, createLogger } from "@zudojs/logger";
import type { Logger } from "@zudojs/logger";
import type { ServiceConfig } from "../serviceConfig/index.js";
import { parseLogLevel } from "./serviceLogger.level.js";
import { createStdoutTransport } from "./serviceLogger.transport.js";

/**
 * Creates the root logger for a service.
 *
 * Development pretty-prints each entry across several lines, which is
 * readable in a terminal. Every other environment emits one line per entry,
 * which is what a log collector expects.
 *
 * @param config - The service's configuration.
 * @returns The root logger.
 */
export function createServiceLogger(config: ServiceConfig): Logger {
  return createLogger({
    name: config.serviceName,
    level: parseLogLevel(config.logLevel),
    environment: config.environment,
    formatter: createJsonLoggerFormatter({
      pretty: config.environment === "development",
    }),
    transports: [createStdoutTransport()],
    metadata: {
      service: config.serviceName,
      version: config.version,
      environment: config.environment,
    },
  });
}

/**
 * Derives a logger that stamps every line with a request identifier.
 *
 * @param logger - The logger to derive from.
 * @param requestId - The correlation identifier to attach.
 * @returns A child logger carrying the identifier.
 */
export function withRequestId(logger: Logger, requestId: string): Logger {
  return logger.child({ metadata: { requestId } });
}
