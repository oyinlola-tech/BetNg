import { consoleSink, createLogger } from "@betng/ui-core";
import { env } from "../configs/env";

export const logger = createLogger({ minLevel: env.logLevel, sinks: [consoleSink] });
