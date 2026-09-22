export {
  DEFAULT_SHUTDOWN_TIMEOUT_MS,
  installProcessHandlers,
  runService,
  shutdownTimeoutFromEnv,
} from "./serviceRunner.core.js";
export type { RunnableService, RunServiceOptions, ShutdownController } from "./serviceRunner.core.js";
