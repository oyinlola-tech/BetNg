import { runService } from "@betng/service-kit";
import { createApp } from "./app.js";
import { loadSettlementConfig } from "./configs/index.js";

await runService(async () => {
  const config = await loadSettlementConfig();

  return createApp(config);
});
