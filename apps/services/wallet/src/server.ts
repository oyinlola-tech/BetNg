/**
 * Wallet service entrypoint.
 */

import { runService } from "@betng/service-kit";
import { createApp } from "./app.js";
import { loadWalletConfig } from "./configs/index.js";

await runService(async () => {
  const config = await loadWalletConfig();

  return createApp(config);
});
