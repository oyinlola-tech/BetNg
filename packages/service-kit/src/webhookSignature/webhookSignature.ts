import { createHmac, timingSafeEqual } from "node:crypto";

/** Bachs and SendByte both sign `"<unix seconds>.<raw body>"` and send it as `t=<t>,v1=<hex>`. */
export const DEFAULT_TOLERANCE_SECONDS = 300;

const HEADER_PATTERN = /^\s*t\s*=\s*(\d{1,12})\s*,\s*v1\s*=\s*([0-9a-fA-F]{64})\s*$/u;

export type SignatureFailure =
  | "MISSING"
  | "MALFORMED"
  | "STALE"
  | "MISMATCH";

export class WebhookSignatureError extends Error {
  public readonly reason: SignatureFailure;

  public constructor(reason: SignatureFailure) {
    super(`Webhook signature ${reason.toLowerCase()}.`);
    this.name = "WebhookSignatureError";
    this.reason = reason;
  }
}

export interface VerifyWebhookSignatureOptions {
  /** The raw request bytes, exactly as received. A re-serialised object will not verify. */
  readonly body: Uint8Array;
  /** The `t=…,v1=…` header value. */
  readonly header: string | undefined;
  /**
   * Every secret currently valid for this endpoint. Both providers sign with the old and the new
   * secret during a rotation window, so a rotation is a deployment with two entries here.
   */
  readonly secrets: readonly string[];
  readonly toleranceSeconds?: number;
  /** Seconds since the epoch; injectable so a test can pin the clock. */
  readonly now?: number;
}

function digestsMatch(left: string, right: string): boolean {
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");

  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Throws a `WebhookSignatureError` unless the header carries a fresh signature made with one of
 * `secrets` over the raw body. Never reports which secret matched.
 */
export function verifyWebhookSignature(options: VerifyWebhookSignatureOptions): void {
  if (options.header === undefined || options.header === "") {
    throw new WebhookSignatureError("MISSING");
  }

  const parsed = HEADER_PATTERN.exec(options.header);

  if (parsed === null) {
    throw new WebhookSignatureError("MALFORMED");
  }

  const timestamp = Number(parsed[1]);
  const signature = (parsed[2] ?? "").toLowerCase();
  const tolerance = options.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  const now = options.now ?? Math.floor(Date.now() / 1000);

  // A future timestamp is as suspect as a stale one: both mean the sender's clock is not ours.
  if (Math.abs(now - timestamp) > tolerance) {
    throw new WebhookSignatureError("STALE");
  }

  const signed = Buffer.concat([Buffer.from(`${String(timestamp)}.`, "utf8"), Buffer.from(options.body)]);

  // Every secret is tried even after a match, so the time taken does not say which one it was.
  let matched = false;

  for (const secret of options.secrets) {
    if (secret === "") {
      continue;
    }

    const expected = createHmac("sha256", secret).update(signed).digest("hex");

    matched = digestsMatch(expected, signature) || matched;
  }

  if (!matched) {
    throw new WebhookSignatureError("MISMATCH");
  }
}
