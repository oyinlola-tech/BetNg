import { isRPCError } from "@zudojs/rpc";
import { SCHEDULER } from "../constants/index.js";

export function backoffMs(failureCount: number): number {
  const exponent = Math.max(0, Math.min(failureCount - 1, 16));

  return Math.min(
    SCHEDULER.BACKOFF_MAX_MS,
    SCHEDULER.BACKOFF_BASE_MS * 2 ** exponent,
  );
}

export class PeerAnswerError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "PeerAnswerError";
  }
}

/** Stored on the match and shown to admins, so it carries a code and an error class, never a peer's own text. */
export function failureReason(code: string, error: unknown): string {
  if (error instanceof PeerAnswerError)
    return `${code}: ${error.message}`.slice(0, 240);

  const kind = isRPCError(error)
    ? String(error.code)
    : error instanceof Error
      ? error.name
      : "Error";

  return `${code}: ${kind}`.slice(0, 240);
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
