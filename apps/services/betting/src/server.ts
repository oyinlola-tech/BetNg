/**
 * Betting service entrypoint.
 */

import { runService } from "@betng/service-kit";
import { createApp } from "./app.js";
import { loadBettingConfig } from "./configs/index.js";

await runService(async () => {
  const config = await loadBettingConfig();

  return createApp(config);
});
