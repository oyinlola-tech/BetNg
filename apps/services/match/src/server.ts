/**
 * Match service entrypoint.
 */

import { runService } from "@betng/service-kit";
import { createApp } from "./app.js";
import { loadMatchConfig } from "./configs/index.js";

await runService(async () => {
  const config = await loadMatchConfig();

  return createApp(config);
});
