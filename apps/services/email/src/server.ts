import { runService } from "@betng/service-kit";
import { createApp } from "./app.js";
import { loadEmailConfig } from "./configs/index.js";

await runService(async () => {
  const app = createApp(await loadEmailConfig());

  await app.prepare();

  return app;
});
