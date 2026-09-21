import { runService } from "@betng/service-kit";
import { createApp } from "./app.js";
import { loadMatchConfig } from "./configs/index.js";

await runService(async () => {
  const app = createApp(await loadMatchConfig());

  await app.startBackground();

  return app;
});
