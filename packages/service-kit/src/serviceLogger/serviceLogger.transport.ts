import { createLoggerTransport } from "@zudojs/logger";
import type { RegisteredLoggerTransport } from "@zudojs/logger";

/**
 * Writes each formatted entry to stdout as one line.
 *
 * The JSON formatter has already turned the entry into a JSON string, which
 * `@zudojs/logger` puts on `entry.message` before the transport runs. The
 * built-in console transport would then wrap that string in a second object
 * and hand it to `console.info`, which Node pretty-prints — two layers of
 * escaping around what should be one parseable line. Writing the formatted
 * string straight to stdout keeps the formatter's output intact.
 */
export function createStdoutTransport(): RegisteredLoggerTransport {
  return createLoggerTransport({
    name: "stdout",
    enabled: true,
    write(entry): void {
      process.stdout.write(`${entry.message}\n`);
    },
  });
}
