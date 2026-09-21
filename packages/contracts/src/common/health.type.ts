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

export interface DependencyCheck {
  readonly name: string;
  readonly status: HealthStatus;
  readonly latencyMs: number;
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
