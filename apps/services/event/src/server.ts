import { runService } from "@betng/service-kit";
import { createApp } from "./app.js";
import { loadEventConfig } from "./configs/index.js";

await runService(async () => {
  const config = await loadEventConfig();

  return createApp(config);
});
