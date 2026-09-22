import type { Logger } from "@betng/service-kit";
import type { LiveController } from "../controllers/index.js";

export function loadRevalidation(live: LiveController, intervalMs: number, logger: Logger): () => void {
  let running = false;

  const timer = setInterval(() => {
    if (running) return;

    running = true;

    live
      .revalidate()
      .catch((error: unknown) => {
        logger.warn("Live session re-validation failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      })
      .finally(() => {
        running = false;
      });
  }, intervalMs);

  timer.unref();

  return () => {
    clearInterval(timer);
  };
}
