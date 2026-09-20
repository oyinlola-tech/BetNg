/**
 * Structured logging, built on `@zudojs/logger`.
 *
 * Every log line is one JSON object carrying the timestamp, level, service
 * name and message that `docs/development.md` promises, plus whatever
 * metadata the call site attaches. Request-scoped lines additionally carry
 * `requestId`, which is how one request is followed across services.
 */

import {
  createJsonLoggerFormatter,
  createLogger,
  loggerLevelFromName,
  LoggerLevel,
  type Logger,
} from "@zudojs/logger";
import { ConfigurationError } from "@zudojs/errors";
import type { ServiceConfig } from "../config/serviceConfig.js";

/**
 * Parses `LOG_LEVEL`.
 *
 * An unrecognised level is a configuration mistake, not something to paper
 * over with a default: silently logging at `info` when someone asked for
 * `trace` wastes a debugging session.
 */
export function parseLogLevel(name: string): LoggerLevel {
  const level = loggerLevelFromName(name.toLowerCase());
  if (level === undefined) {
    throw new ConfigurationError(
      `LOG_LEVEL must be one of fatal, error, warn, info, debug or trace, ` +
        `got "${name}".`,
    );
  }
  return level;
}

/**
 * Creates the root logger for a service.
 *
 * Development gets a pretty-printed JSON line; anything else gets one line
 * per entry, which is what a log collector expects.
 */
export function createServiceLogger(config: ServiceConfig): Logger {
  return createLogger({
    name: config.serviceName,
    level: parseLogLevel(config.logLevel),
    environment: config.environment,
    formatter: createJsonLoggerFormatter({
      pretty: config.environment === "development",
    }),
    metadata: {
      service: config.serviceName,
      version: config.version,
      environment: config.environment,
    },
  });
}

/**
 * Derives a logger that stamps every line with a request id.
 *
 * Used by the request pipeline so handlers log correlated lines without
 * having to pass the id around themselves.
 */
export function withRequestId(logger: Logger, requestId: string): Logger {
  return logger.child({ metadata: { requestId } });
}

export { LoggerLevel, type Logger };
