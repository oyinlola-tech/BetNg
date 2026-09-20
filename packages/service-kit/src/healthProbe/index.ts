/**
 * @betng/service-kit/healthProbe
 *
 * Dependency probes behind the readiness endpoint.
 */

export { PROBE_TIMEOUT_MS } from "./dependencyProbe.type.js";
export type { DependencyProbe } from "./dependencyProbe.type.js";

export { runProbes } from "./dependencyProbe.runner.js";
export type { ReadinessOutcome } from "./dependencyProbe.runner.js";
