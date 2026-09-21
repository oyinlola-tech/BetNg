/**
 * How a peer's RPC failure is classified.
 *
 * The distinction matters for money. A refusal is definite: the peer answered
 * and did nothing. Anything else — a timeout, a dropped connection, a fault —
 * leaves the outcome unknown, and the caller must not assume either way.
 */

export class PeerRefusedError extends Error {
  public readonly code: string;

  public constructor(peer: string, code: string) {
    super(`The ${peer} service refused the call with ${code}.`);
    this.name = "PeerRefusedError";
    this.code = code;
  }
}

export class PeerUnavailableError extends Error {
  public constructor(peer: string, cause: unknown) {
    super(`The ${peer} service did not give a usable answer.`, { cause });
    this.name = "PeerUnavailableError";
  }
}

const TRANSPORT_CODE = /^(ERR_)?RPC_/;

/** Turns whatever an RPC call threw into one of the two classes above. */
export function classifyPeerFailure(peer: string, error: unknown): Error {
  const code =
    typeof error === "object" && error !== null
      ? (error as { code?: unknown }).code
      : undefined;

  return typeof code === "string" && code !== "" && !TRANSPORT_CODE.test(code)
    ? new PeerRefusedError(peer, code)
    : new PeerUnavailableError(peer, error);
}
