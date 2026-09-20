/**
 * Gateway entrypoint.
 */

import { runService } from "@betng/service-kit";
import { createApp } from "./app.js";
import { loadGatewayConfig } from "./configs/index.js";

await runService(async () => {
  const config = await loadGatewayConfig();

  return createApp(config);
});
