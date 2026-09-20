/**
 * Dependency probes for the readiness endpoint.
 *
 * A probe actually talks to the thing it names. A service declares only the
 * dependencies it genuinely has, so `/ready` cannot report a dependency the
 * service does not use, and cannot report one as healthy without having just
 * reached it.
 */

import type { DependencyCheck, HealthStatus } from "@betng/contracts";

/** A named check that answers "can I reach this right now?". */
export interface DependencyProbe {
  readonly name: string;
  /** Resolves when the dependency answered; rejects when it did not. */
  readonly check: (signal: AbortSignal) => Promise<void>;
  /**
   * Whether the service can serve without this dependency.
   *
   * A failing optional dependency makes the service `degraded` but still
   * ready; a failing required one makes it `unavailable`.
   */
  readonly optional?: boolean;
}

const PROBE_TIMEOUT_MS = 2000;

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

/** Runs every probe concurrently and folds the results into one status. */
export async function runProbes(probes: readonly DependencyProbe[]): Promise<{
  readonly status: HealthStatus;
  readonly dependencies: readonly DependencyCheck[];
}> {
  const dependencies = await Promise.all(probes.map(runProbe));

  const status: HealthStatus = dependencies.some(
    (check) => check.status === "unavailable",
  )
    ? "unavailable"
    : dependencies.some((check) => check.status === "degraded")
      ? "degraded"
      : "ok";

  return { status, dependencies };
}
