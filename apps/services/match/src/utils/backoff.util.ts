import { SCHEDULER } from "../constants/index.js";

/** Exponential backoff: 2 s after the first failure, doubling, capped at a minute. */
export function backoffMs(failureCount: number): number {
  const exponent = Math.max(0, Math.min(failureCount - 1, 16));

  return Math.min(SCHEDULER.BACKOFF_MAX_MS, SCHEDULER.BACKOFF_BASE_MS * 2 ** exponent);
}

/** A failure reason safe to store and show: one line, bounded, no stack. */
export function failureReason(code: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  return `${code}: ${message}`.replace(/\s+/g, " ").slice(0, 240);
}
