import { loadSecretFiles } from "../secrets/secretFiles.js";
import type { Logger } from "@zudojs/logger";
import { describeError, stacksAllowed } from "../httpError/index.js";
import type { ServiceServer } from "../httpServer/index.js";

export interface RunnableService {
  readonly server: ServiceServer;
  readonly logger: Logger;
  readonly onShutdown?: readonly (() => Promise<void>)[];
}

export interface RunServiceOptions {
  /** How long the whole shutdown may take before the process is forced out. */
  readonly shutdownTimeoutMs?: number;
  readonly exit?: (code: number) => void;
  readonly processLike?: Pick<NodeJS.Process, "on" | "once" | "off">;
}

export const DEFAULT_SHUTDOWN_TIMEOUT_MS = 15_000;

export function shutdownTimeoutFromEnv(
  env: Readonly<Record<string, string | undefined>> = process.env,
): number {
  const raw = env["SHUTDOWN_TIMEOUT_MS"];
  const value = raw === undefined || raw === "" ? DEFAULT_SHUTDOWN_TIMEOUT_MS : Number(raw);

  if (!Number.isInteger(value) || value < 1000 || value > 120_000) {
    throw new Error(`SHUTDOWN_TIMEOUT_MS must be an integer between 1000 and 120000, got "${String(raw)}".`);
  }

  return value;
}

export interface ShutdownController {
  readonly shutdown: (reason: string, exitCode: number) => Promise<void>;
  readonly dispose: () => void;
}

export function installProcessHandlers(
  service: RunnableService,
  options: RunServiceOptions = {},
): ShutdownController {
  const { logger } = service;
  const exit = options.exit ?? ((code: number) => process.exit(code));
  const target = options.processLike ?? process;
  const timeoutMs = options.shutdownTimeoutMs ?? shutdownTimeoutFromEnv();
  const logStacks = stacksAllowed();
  let running: Promise<void> | undefined;

  const shutdown = (reason: string, exitCode: number): Promise<void> => {
    if (running !== undefined) return running;

    logger.info("Shutting down", { reason });

    const timer = setTimeout(() => {
      logger.error("Shutdown timed out; exiting", { timeoutMs });
      exit(1);
    }, timeoutMs);

    timer.unref();

    running = (async () => {
      let code = exitCode;

      try {
        await service.server.stop();
      } catch (error) {
        code = 1;
        logger.error("Server did not stop cleanly", describeError(error, logStacks));
      }

      for (const release of service.onShutdown ?? []) {
        try {
          await release();
        } catch (error) {
          code = 1;
          logger.error("A shutdown step failed", describeError(error, logStacks));
        }
      }

      clearTimeout(timer);
      await logger.flush().catch(() => undefined);
      exit(code);
    })();

    return running;
  };

  const onSignal = (signal: NodeJS.Signals): void => {
    void shutdown(signal, 0);
  };

  const onRejection = (reason: unknown): void => {
    logger.error("Unhandled promise rejection", describeError(reason, logStacks));
    void shutdown("unhandledRejection", 1);
  };

  // The process state is unknown after an uncaught exception, so it always ends in an exit.
  const onException = (error: Error): void => {
    logger.error("Uncaught exception", describeError(error, logStacks));
    void shutdown("uncaughtException", 1);
  };

  target.once("SIGINT", onSignal);
  target.once("SIGTERM", onSignal);
  target.on("unhandledRejection", onRejection);
  target.on("uncaughtException", onException);

  return {
    shutdown,
    dispose: () => {
      target.off("SIGINT", onSignal);
      target.off("SIGTERM", onSignal);
      target.off("unhandledRejection", onRejection);
      target.off("uncaughtException", onException);
    },
  };
}

export async function runService(
  bootstrap: () => Promise<RunnableService>,
  options: RunServiceOptions = {},
): Promise<void> {
  let service: RunnableService;

  try {
    loadSecretFiles();
    service = await bootstrap();
    await service.server.start();
  } catch (error) {
    console.error(
      "Service failed to start:",
      JSON.stringify(describeError(error, stacksAllowed())),
    );
    process.exitCode = 1;
    return;
  }

  installProcessHandlers(service, options);
}
