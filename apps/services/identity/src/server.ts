import { runService } from "@betng/service-kit";
import { createApp } from "./app.js";
import { loadIdentityConfig } from "./configs/index.js";

await runService(async () => {
  const app = createApp(await loadIdentityConfig());

  await app.prepare();

  return app;
});
