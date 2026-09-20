/**
 * Match service entrypoint.
 */

import { runService } from "@betng/service-kit";
import { createApp } from "./app.js";
import { loadMatchConfig } from "./configs/index.js";

await runService(async () => {
  const config = await loadMatchConfig();
  const app = await createApp(config);

  return {
    server: app.server,
    logger: app.logger,
    onShutdown: app.onShutdown,
  };
});
