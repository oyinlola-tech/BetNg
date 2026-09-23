/** The provider could not be reached, timed out, or answered 5xx/429 or nonsense. Safe to retry. */
export class ProviderUnavailableError extends Error {
  public readonly provider: string;

  public constructor(provider: string, detail: string) {
    super(`${provider} unavailable: ${detail}`);
    this.name = "ProviderUnavailableError";
    this.provider = provider;
  }
}

/** The provider answered and refused (4xx). Only the status and code are kept: messages can carry an address. */
export class ProviderRefusedError extends Error {
  public readonly provider: string;

  public readonly status: number;

  public readonly code: string | undefined;

  public constructor(provider: string, status: number, code?: string) {
    super(`${provider} refused the request with ${String(status)}${code === undefined ? "" : ` (${code})`}.`);
    this.name = "ProviderRefusedError";
    this.provider = provider;
    this.status = status;
    this.code = code;
  }
}

export class WebhookRejectedError extends Error {
  public constructor(reason: string) {
    super(reason);
    this.name = "WebhookRejectedError";
  }
}

const MAX_RESPONSE_BYTES = 1024 * 1024;

/** SendByte error bodies are `{ "error": { "code": "…" } }` or `{ "code": "…" }`; only the code is read. */
const ERROR_CODE_PATTERN = /"code"\s*:\s*"([A-Za-z0-9_-]{1,60})"/u;

export interface ProviderRequest {
  readonly provider: string;
  readonly baseUrl: string;
  readonly path: string;
  readonly method: "GET" | "POST";
  readonly secretKey: string;
  readonly timeoutMs: number;
  readonly idempotencyKey?: string;
  readonly body?: unknown;
}

export async function callProvider(request: ProviderRequest): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, request.timeoutMs);

  let response: Response;

  try {
    response = await fetch(`${request.baseUrl}${request.path}`, {
      method: request.method,
      headers: {
        authorization: `Bearer ${request.secretKey}`,
        accept: "application/json",
        ...(request.idempotencyKey === undefined ? {} : { "idempotency-key": request.idempotencyKey }),
        ...(request.body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
      redirect: "error",
      signal: controller.signal,
    });
  } catch (error) {
    throw new ProviderUnavailableError(
      request.provider,
      error instanceof Error && error.name === "AbortError" ? "timed out" : "unreachable",
    );
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();

  if (text.length > MAX_RESPONSE_BYTES) {
    throw new ProviderUnavailableError(request.provider, "response too large");
  }

  if (response.status >= 500 || response.status === 429) {
    throw new ProviderUnavailableError(request.provider, `status ${String(response.status)}`);
  }

  if (response.status >= 400) {
    throw new ProviderRefusedError(request.provider, response.status, ERROR_CODE_PATTERN.exec(text)?.[1]);
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ProviderUnavailableError(request.provider, "response is not JSON");
  }
}

export function record(value: unknown): Readonly<Record<string, unknown>> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : undefined;
}

export function stringField(source: Readonly<Record<string, unknown>> | undefined, key: string): string | undefined {
  const value = source?.[key];

  return typeof value === "string" && value !== "" ? value : undefined;
}

export function dateField(source: Readonly<Record<string, unknown>> | undefined, key: string): Date | undefined {
  const raw = stringField(source, key);

  if (raw === undefined) {
    return undefined;
  }

  const parsed = new Date(raw);

  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}
