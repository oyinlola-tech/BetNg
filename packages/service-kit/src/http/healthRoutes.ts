/**
 * The `/health` and `/ready` endpoints every BetNG service exposes.
 *
 * They sit outside `/api/v1` on purpose: they describe the process, not the
 * domain, and an orchestrator probing them should not be coupled to an API
 * version.
 *
 * `/health` answers 200 whenever the process is serving. It inspects no
 * dependency, so it can never claim one is healthy.
 *
 * `/ready` probes every dependency the service actually declared, right now.
 * It answers 200 only when all of them are reachable, and 503 otherwise, so
 * a service with a dead database is taken out of rotation rather than being
 * handed requests it cannot serve.
 */

import type { HealthResponse, ReadinessResponse } from "@betng/contracts";
import { createResponseContext, type HttpRouter } from "@zudojs/http";
import type { ServiceConfig } from "../config/serviceConfig.js";
import { runProbes, type DependencyProbe } from "../health/probes.js";

export function registerHealthRoutes(
  router: HttpRouter,
  config: ServiceConfig,
  probes: readonly DependencyProbe[],
): void {
  const startedAt = Date.now();

  router.get("/health", () => {
    const body: HealthResponse = {
      status: "ok",
      service: config.serviceName,
      version: config.version,
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      timestamp: new Date().toISOString(),
    };
    return createResponseContext({ status: 200 }).json(body);
  });

  router.get("/ready", async () => {
    const { status, dependencies } = await runProbes(probes);

    const body: ReadinessResponse = {
      status,
      service: config.serviceName,
      version: config.version,
      timestamp: new Date().toISOString(),
      dependencies,
    };

    return createResponseContext({
      status: status === "unavailable" ? 503 : 200,
    }).json(body);
  });
}
