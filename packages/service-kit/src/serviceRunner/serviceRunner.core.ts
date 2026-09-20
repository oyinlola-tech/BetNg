/**
 * Process lifecycle for a BetNG service.
 *
 * Wraps startup and shutdown so every service behaves the same way at the
 * edges: a configuration mistake fails loudly before the port is bound, and
 * SIGINT or SIGTERM closes the listener before releasing pools, so
 * in-flight requests finish instead of seeing a dropped connection.
 */

import type { Logger } from "@zudojs/logger";
import type { ServiceServer } from "../httpServer/index.js";

export interface RunnableService {
  readonly server: ServiceServer;
  readonly logger: Logger;
  readonly onShutdown?: readonly (() => Promise<void>)[];
}

const SHUTDOWN_TIMEOUT_MS = 10_000;

function installShutdown(service: RunnableService): void {
  const { logger } = service;
  let shuttingDown = false;

  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    logger.info("Shutting down", { signal });

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

/**
 * Starts a service and keeps it running until the process is signalled.
 *
 * A `bootstrap` that throws exits with code 1 before anything is bound,
 * which is what makes a bad `.env` obvious.
 */
export async function runService(
  bootstrap: () => Promise<RunnableService>,
): Promise<void> {
  let service: RunnableService;

  try {
    service = await bootstrap();
    await service.server.start();
  } catch (error) {
    console.error(
      "Service failed to start:",
      error instanceof Error ? (error.stack ?? error.message) : error,
    );
    process.exitCode = 1;
    return;
  }

  installShutdown(service);
}
