import { loggerLevelFromName, LoggerLevel } from "@zudojs/logger";
import { ConfigurationError } from "@zudojs/errors";

/**
 * Parses `LOG_LEVEL`.
 *
 * An unrecognised level is a configuration mistake, not something to paper
 * over with a default: silently logging at `info` when someone asked for
 * `trace` wastes a debugging session.
 *
 * @throws {ConfigurationError} When the name is not a level.
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
