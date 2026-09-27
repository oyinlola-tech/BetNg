import { createLoggerTransport } from "@zudojs/logger";
import type { RegisteredLoggerTransport } from "@zudojs/logger";

/**
 * Writes each formatted entry to stdout as one line.
 *
 * The JSON formatter has already turned the entry into a JSON string, which
 * `@zudojs/logger` carries on `entry.formatted`; `entry.message` is the raw
 * message. Writing the formatted string straight to stdout keeps the
 * formatter's output intact: one parseable line per entry.
 */
export function createStdoutTransport(): RegisteredLoggerTransport {
  return createLoggerTransport({
    name: "stdout",
    enabled: true,
    write(entry): void {
      process.stdout.write(`${entry.formatted ?? entry.message}\n`);
    },
  });
}
