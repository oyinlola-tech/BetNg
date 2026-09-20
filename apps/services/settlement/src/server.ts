import {
  createHttpServer,
  createNodeHttpAdapter,
  createResponseContext,
  type HttpRequestContext,
} from "@zudojs/http";

import { createApp } from "./app.js";

const DEFAULT_PORT = 3004;

/** Reads PORT, refusing values that are not a TCP port. */
function resolvePort(): number {
  const raw = process.env["PORT"];
  if (raw === undefined || raw.trim() === "") return DEFAULT_PORT;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`PORT must be an integer between 0 and 65535, got "${raw}".`);
  }
  return port;
}

const runtime = createApp();
await runtime.start();

const server = createHttpServer({
  adapter: createNodeHttpAdapter({
    host: process.env["HOST"] ?? "0.0.0.0",
    port: resolvePort(),
  }),
  handler: (request: HttpRequestContext) => {
    if (request.path === "/health") {
      if (runtime.state !== "running") {
        return createResponseContext({ status: 503 }).json({ status: "unavailable" });
      }
      return { status: "ok", timestamp: new Date().toISOString() };
    }
    return createResponseContext({ status: 404 }).json({ error: "Not Found" });
  },
});

await server.start();
console.log(`Listening on port ${server.address?.port ?? resolvePort()}`);

let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    if (stopping) return;
    stopping = true;
    void server
      .stop()
      .then(() => runtime.stop())
      .then(() => {
        process.exit(0);
      })
      .catch((error: unknown) => {
        console.error(error);
        process.exit(1);
      });
  });
}
