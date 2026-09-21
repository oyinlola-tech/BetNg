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

// A domain code is a definite refusal; a transport code (RPC_*) leaves the outcome unknown.
export function classifyPeerFailure(peer: string, error: unknown): Error {
  const code =
    typeof error === "object" && error !== null
      ? (error as { code?: unknown }).code
      : undefined;

  return typeof code === "string" && code !== "" && !TRANSPORT_CODE.test(code)
    ? new PeerRefusedError(peer, code)
    : new PeerUnavailableError(peer, error);
}
