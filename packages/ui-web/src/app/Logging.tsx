import { createContext, useContext, type ReactNode } from "react";
import { createLogger, type Logger } from "@betng/ui-core";

const silent = createLogger({ sinks: [] });
const LoggerContext = createContext<Logger>(silent);

export interface LoggerProviderProps {
  readonly logger: Logger;
  readonly children: ReactNode;
}

export function LoggerProvider({
  logger,
  children,
}: LoggerProviderProps): React.JSX.Element {
  return <LoggerContext.Provider value={logger}>{children}</LoggerContext.Provider>;
}

export function useLogger(): Logger {
  return useContext(LoggerContext);
}

const LONG_TASK_MS = 250;

/** Routes unhandled errors, rejected promises and long main-thread tasks to the logger. Returns the uninstaller. */
export function installGlobalLogging(logger: Logger): () => void {
  const onError = (event: ErrorEvent): void => {
    logger.error("ui", "Unhandled error", {
      message: event.message,
      source: event.filename,
      line: event.lineno,
    });
  };
  const onRejection = (event: PromiseRejectionEvent): void => {
    logger.error("ui", "Unhandled promise rejection", { reason: event.reason });
  };

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);

  let observer: PerformanceObserver | undefined;

  if (
    typeof PerformanceObserver !== "undefined" &&
    PerformanceObserver.supportedEntryTypes.includes("longtask")
  ) {
    observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration >= LONG_TASK_MS) {
          logger.warn("performance", "Long task", {
            durationMs: Math.round(entry.duration),
          });
        }
      }
    });
    observer.observe({ entryTypes: ["longtask"] });
  }

  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
    observer?.disconnect();
  };
}
