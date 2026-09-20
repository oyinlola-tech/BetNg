/**
 * Running dependency probes and folding their results into one status.
 */

import type { DependencyCheck, HealthStatus } from "@betng/contracts";
import type { DependencyProbe } from "./dependencyProbe.type.js";
import { PROBE_TIMEOUT_MS } from "./dependencyProbe.type.js";

/** The outcome of probing every declared dependency. */
export interface ReadinessOutcome {
  readonly status: HealthStatus;
  readonly dependencies: readonly DependencyCheck[];
}

async function runProbe(probe: DependencyProbe): Promise<DependencyCheck> {
  const startedAt = performance.now();
  const controller = new AbortController();

  const timer = setTimeout(() => {
    controller.abort();
  }, PROBE_TIMEOUT_MS);

  try {
    await probe.check(controller.signal);

    return {
      name: probe.name,
      status: "ok",
      latencyMs: Math.round(performance.now() - startedAt),
    };
  } catch (error) {
    return {
      name: probe.name,
      status: probe.optional === true ? "degraded" : "unavailable",
      latencyMs: Math.round(performance.now() - startedAt),
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

function foldStatus(
  dependencies: readonly DependencyCheck[],
): HealthStatus {
  if (dependencies.some((check) => check.status === "unavailable")) {
    return "unavailable";
  }

  if (dependencies.some((check) => check.status === "degraded")) {
    return "degraded";
  }

  return "ok";
}

/**
 * Runs every probe concurrently.
 *
 * @param probes - The dependencies this service declared.
 * @returns The overall status and the per-dependency results.
 */
export async function runProbes(
  probes: readonly DependencyProbe[],
): Promise<ReadinessOutcome> {
  const dependencies = await Promise.all(probes.map(runProbe));

  return { status: foldStatus(dependencies), dependencies };
}
