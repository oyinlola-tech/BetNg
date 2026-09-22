export const CALLER_PATTERN = /^[a-z][a-z0-9-]{0,31}$/;

export const DEFAULT_RPC_RATE_PER_SECOND = 1000;
export const DEFAULT_RPC_BURST = 2000;
export const MAX_TRACKED_CALLERS = 64;
export const UNKNOWN_CALLER = "unknown";

export interface CallerRateLimiter {
  /** Takes one token; resolves to 0 when allowed, else seconds until one is free. */
  readonly acquire: (caller: string) => number;
  readonly tracked: () => number;
}

type Env = Readonly<Record<string, string | undefined>>;

export function callerName(raw: string | undefined): string {
  return raw !== undefined && CALLER_PATTERN.test(raw) ? raw : UNKNOWN_CALLER;
}

export function createCallerRateLimiter(
  ratePerSecond: number,
  burst: number,
  clock: () => number = () => performance.now() / 1000,
): CallerRateLimiter {
  if (!(ratePerSecond > 0) || !Number.isFinite(ratePerSecond) || !(burst >= 1)) {
    throw new Error("A rate limit needs a positive rate and a burst of 1+.");
  }

  const buckets = new Map<string, { tokens: number; updatedAt: number }>();

  return {
    acquire: (caller) => {
      const now = clock();
      const key = buckets.has(caller) || buckets.size < MAX_TRACKED_CALLERS ? caller : UNKNOWN_CALLER;
      let bucket = buckets.get(key);

      if (bucket === undefined) {
        bucket = { tokens: burst, updatedAt: now };
        buckets.set(key, bucket);
      }

      bucket.tokens = Math.min(burst, bucket.tokens + (now - bucket.updatedAt) * ratePerSecond);
      bucket.updatedAt = now;

      if (bucket.tokens >= 1 - 1e-9) {
        bucket.tokens -= 1;

        return 0;
      }

      return (1 - bucket.tokens) / ratePerSecond;
    },
    tracked: () => buckets.size,
  };
}

/** `RPC_RATE_LIMIT_PER_SECOND` / `RPC_RATE_LIMIT_BURST`; a rate of 0 disables the limit. */
export function rpcRateLimiterFromEnv(env: Env = process.env): CallerRateLimiter | undefined {
  const rawRate = env["RPC_RATE_LIMIT_PER_SECOND"];
  const rawBurst = env["RPC_RATE_LIMIT_BURST"];
  const rate = rawRate === undefined || rawRate === "" ? DEFAULT_RPC_RATE_PER_SECOND : Number(rawRate);
  const burst = rawBurst === undefined || rawBurst === "" ? DEFAULT_RPC_BURST : Number(rawBurst);

  if (!Number.isFinite(rate) || rate < 0 || !Number.isInteger(burst) || burst < 0) {
    throw new Error("RPC_RATE_LIMIT_PER_SECOND and RPC_RATE_LIMIT_BURST must be non-negative numbers.");
  }

  return rate === 0 ? undefined : createCallerRateLimiter(rate, Math.max(burst, 1));
}
