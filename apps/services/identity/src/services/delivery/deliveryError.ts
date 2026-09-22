/** Carries the provider and status only: a provider's answer may echo the message, which can hold a code. */
export class DeliveryError extends Error {
  public readonly provider: string;

  public readonly status: number | undefined;

  public constructor(provider: string, status: number | undefined, reason: string) {
    super(`${provider} did not accept the message (${status === undefined ? reason : `HTTP ${String(status)}`}).`);
    this.name = "DeliveryError";
    this.provider = provider;
    this.status = status;
  }
}

export async function postJson(
  provider: string,
  url: string,
  init: { readonly headers: Readonly<Record<string, string>>; readonly body: string; readonly timeoutMs: number },
): Promise<Response> {
  try {
    return await fetch(url, {
      method: "POST",
      headers: init.headers,
      body: init.body,
      redirect: "error",
      signal: AbortSignal.timeout(init.timeoutMs),
    });
  } catch (error) {
    throw new DeliveryError(provider, undefined, error instanceof Error && error.name === "TimeoutError" ? "timed out" : "network error");
  }
}
