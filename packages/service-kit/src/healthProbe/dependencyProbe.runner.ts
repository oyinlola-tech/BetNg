import type { DependencyCheck, HealthStatus } from "@betng/contracts";
import type { DependencyProbe } from "./dependencyProbe.type.js";
import { PROBE_TIMEOUT_MS } from "./dependencyProbe.type.js";

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
      error: redact(error instanceof Error ? error.message : String(error)),
    };
  } finally {
    clearTimeout(timer);
  }
}

/** `/ready` can be reachable from outside; addresses and credentials must not be in it. */
function redact(message: string): string {
  return (message.split("\n")[0] ?? "")
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/\S+/gi, "<url>")
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b/g, "<address>")
    .slice(0, 160);
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

export async function runProbes(
  probes: readonly DependencyProbe[],
): Promise<ReadinessOutcome> {
  const dependencies = await Promise.all(probes.map(runProbe));

  return { status: foldStatus(dependencies), dependencies };
}
