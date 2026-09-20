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
  createLoggerTransport,
  loggerLevelFromName,
  LoggerLevel,
  type Logger,
  type RegisteredLoggerTransport,
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
 * Writes each formatted entry to stdout as one line.
 *
 * The JSON formatter already turned the entry into a JSON string, which
 * `@zudojs/logger` puts on `entry.message` before the transport runs. The
 * console transport would then wrap that string in a second object and hand
 * it to `console.info`, which Node pretty-prints — two layers of escaping
 * around what should be one line a collector can parse. Writing the
 * formatted string straight to stdout keeps the formatter's output intact.
 */
function createStdoutTransport(): RegisteredLoggerTransport {
  return createLoggerTransport({
    name: "stdout",
    enabled: true,
    write(entry): void {
      process.stdout.write(`${entry.message}\n`);
    },
  });
}

/**
 * Creates the root logger for a service.
 *
 * Every line is one JSON object. Development pretty-prints it across several
 * lines, which is readable in a terminal; every other environment emits a
 * single line, which is what a log collector expects.
 */
export function createServiceLogger(config: ServiceConfig): Logger {
  const pretty = config.environment === "development";

  return createLogger({
    name: config.serviceName,
    level: parseLogLevel(config.logLevel),
    environment: config.environment,
    formatter: createJsonLoggerFormatter({ pretty }),
    transports: [createStdoutTransport()],
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
