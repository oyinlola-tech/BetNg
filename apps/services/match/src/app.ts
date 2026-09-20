import { resolveEnvironment } from "@zudojs/constants";
import { createContainer } from "@zudojs/container";
import type { Module } from "@zudojs/core";
import { createEventBus } from "@zudojs/events";
import { createLogger } from "@zudojs/logger";
import { createRuntime, type Runtime } from "@zudojs/runtime";
import { MatchModule } from "./modules/index.js";

/**
 * Assembles the application runtime.
 *
 * `createRuntime` takes two arguments: the dependencies the runtime and its
 * modules share, and the options describing this application.
 */
export function createApp(): Runtime {
  const logger = createLogger({ name: "betng-match" });
  const container = createContainer();
  const eventBus = createEventBus();

  const modules = new Map<string, Module>();
  for (const module of [
    new MatchModule(),
  ]) {
    modules.set(module.id, module);
  }

  const runtime = createRuntime(
    { modules, logger, container, eventBus },
    {
      applicationName: "betng-match",
      applicationVersion: "0.1.0",
      // NODE_ENV is read the same way the framework reads it: `prod` and
      // `Production` are production, an unknown value warns once.
      environment: resolveEnvironment(),
      // Signals are handled explicitly in server.ts.
      handleSignals: false,
      metadata: { port: 3001 },
    },
  );

  runtime.registerReadinessCheck("modules", () => runtime.state === "running");

  return runtime;
}
