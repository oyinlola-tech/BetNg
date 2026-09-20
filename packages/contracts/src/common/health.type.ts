/**
 * Health and readiness contracts.
 *
 * Every BetNG service, TypeScript and Python alike, exposes `GET /health`
 * and `GET /ready` with these shapes.
 *
 * `/health` is liveness: the process is up and serving. It inspects no
 * dependency, so it can never report one as healthy.
 *
 * `/ready` is readiness: every dependency the service is actually configured
 * to use has been probed just now. A service with no configured dependency
 * reports an empty list rather than inventing one.
 */

import { z } from "@zudojs/validation";

export const healthStatusSchema = z.enum(["ok", "degraded", "unavailable"]);

export type HealthStatus = z.infer<typeof healthStatusSchema>;

export interface HealthResponse {
  readonly status: HealthStatus;
  readonly service: string;
  readonly version: string;
  readonly uptimeSeconds: number;
  readonly timestamp: string;
}

export const healthResponseSchema = z.object({
  status: healthStatusSchema,
  service: z.string(),
  version: z.string(),
  uptimeSeconds: z.number().min(0),
  timestamp: z.iso.datetime(),
});

/** The outcome of probing one dependency. */
export interface DependencyCheck {
  /** The dependency's name, such as `postgres` or `match-service`. */
  readonly name: string;
  readonly status: HealthStatus;
  /** How long the probe took, in milliseconds. */
  readonly latencyMs: number;
  /** Present only when the probe failed. */
  readonly error?: string;
}

export const dependencyCheckSchema = z.object({
  name: z.string(),
  status: healthStatusSchema,
  latencyMs: z.number().min(0),
  error: z.string().optional(),
});

export interface ReadinessResponse {
  readonly status: HealthStatus;
  readonly service: string;
  readonly version: string;
  readonly timestamp: string;
  readonly dependencies: readonly DependencyCheck[];
}

export const readinessResponseSchema = z.object({
  status: healthStatusSchema,
  service: z.string(),
  version: z.string(),
  timestamp: z.iso.datetime(),
  dependencies: z.array(dependencyCheckSchema),
});
