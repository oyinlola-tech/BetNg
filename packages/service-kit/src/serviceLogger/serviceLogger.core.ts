import { createJsonLoggerFormatter, createLogger } from "@zudojs/logger";
import type { Logger } from "@zudojs/logger";
import type { ServiceConfig } from "../serviceConfig/index.js";
import { parseLogLevel } from "./serviceLogger.level.js";
import { createStdoutTransport } from "./serviceLogger.transport.js";

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

export function withRequestId(logger: Logger, requestId: string): Logger {
  return logger.child({ metadata: { requestId } });
}
