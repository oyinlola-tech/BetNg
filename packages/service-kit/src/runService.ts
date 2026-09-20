/**
 * Process lifecycle for a BetNG service.
 *
 * Wraps startup and shutdown so every service behaves the same way at the
 * edges: a configuration mistake fails loudly before the port is bound, and
 * SIGINT/SIGTERM close the listener before releasing pools, so in-flight
 * requests finish instead of seeing a dropped connection.
 */

import type { Logger } from "@zudojs/logger";
import type { ServiceServer } from "./http/server.js";

export interface RunnableService {
  readonly server: ServiceServer;
  readonly logger: Logger;
  /** Released after the listener has closed, in the order given. */
  readonly onShutdown?: readonly (() => Promise<void>)[];
}

/** How long a stuck shutdown is allowed to run before the process exits. */
const SHUTDOWN_TIMEOUT_MS = 10_000;

/**
 * Starts a service and keeps it running until the process is signalled.
 *
 * @param bootstrap - Builds the service. Throwing here exits with code 1
 *   before anything is bound, which is what makes a bad `.env` obvious.
 */
export async function runService(
  bootstrap: () => Promise<RunnableService>,
): Promise<void> {
  let service: RunnableService;

  try {
    service = await bootstrap();
    await service.server.start();
  } catch (error) {
    // No logger is guaranteed to exist yet, so this goes to stderr directly.
    console.error(
      "Service failed to start:",
      error instanceof Error ? (error.stack ?? error.message) : error,
    );
    process.exitCode = 1;
    return;
  }

  const { logger } = service;
  let shuttingDown = false;

  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info("Shutting down", { signal });

    // A shutdown that hangs — a pool waiting on a connection that will never
    // come back — must not leave the process wedged forever.
    const timer = setTimeout(() => {
      logger.error("Shutdown timed out; exiting", {
        timeoutMs: SHUTDOWN_TIMEOUT_MS,
      });
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    timer.unref();

    void (async () => {
      try {
        await service.server.stop();
        for (const release of service.onShutdown ?? []) {
          await release();
        }
        await logger.flush();
        clearTimeout(timer);
        process.exit(0);
      } catch (error) {
        logger.error("Shutdown failed", {
          error: error instanceof Error ? error.message : String(error),
        });
        clearTimeout(timer);
        process.exit(1);
      }
    })();
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
