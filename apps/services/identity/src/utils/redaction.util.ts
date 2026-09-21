/**
 * Server-side redaction of audit snapshots.
 *
 * Callers are other services and this one; none is trusted to have removed
 * secrets. Any key that looks like one is dropped, at every depth, before the
 * entry is stored, so the audit log cannot become a credential store.
 */

import { SECURITY } from "../constants/index.js";

const SECRET_KEY = /password|pin|token|secret|hash/iu;

const DEPTH_MARKER = "[TRUNCATED]";

function redactValue(value: unknown, depth: number): unknown {
  if (value === null || typeof value !== "object") {
    return typeof value === "bigint" ? value.toString() : value;
  }

  if (depth >= SECURITY.AUDIT_SNAPSHOT_MAX_DEPTH) {
    return DEPTH_MARKER;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactValue(entry, depth + 1));
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const output: Record<string, unknown> = {};

  for (const [key, inner] of Object.entries(value)) {
    if (!SECRET_KEY.test(key) && inner !== undefined) {
      output[key] = redactValue(inner, depth + 1);
    }
  }

  return output;
}

/**
 * Redacts a snapshot and bounds its stored size.
 *
 * An oversized snapshot is replaced by a marker rather than refused: the fact
 * that the change happened must still be recorded.
 */
export function redactSnapshot(value: unknown): unknown {
  if (value === undefined || value === null) {
    return undefined;
  }

  const redacted = redactValue(value, 0);
  const bytes = Buffer.byteLength(JSON.stringify(redacted) ?? "", "utf8");

  return bytes > SECURITY.AUDIT_SNAPSHOT_MAX_BYTES
    ? { truncated: true, originalBytes: bytes }
    : redacted;
}
