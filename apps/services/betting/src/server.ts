/**
 * Betting service entrypoint.
 */

import { runService } from "@betng/service-kit";
import { createApp } from "./app.js";
import { loadBettingConfig } from "./config/index.js";

await runService(async () => {
  const config = await loadBettingConfig();
  const app = await createApp(config);

  return {
    server: app.server,
    logger: app.logger,
    onShutdown: app.onShutdown,
  };
});
