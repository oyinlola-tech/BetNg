/** A fresh key for one logical operation. Callers keep it across retries of that operation and only mint a new one for a new operation. */
export function createIdempotencyKey(): string {
  return crypto.randomUUID();
}

const SAFE_PATH = /^\/(?!\/)[A-Za-z0-9/_\-?=&.%]*$/;

/** A same-origin path to return to after sign-in or a payment, or the fallback. Rejects `//host`, schemes and backslashes. */
export function safeReturnPath(candidate: string | null | undefined, fallback = "/"): string {
  if (typeof candidate !== "string" || candidate.length > 200) return fallback;
  if (candidate.includes("\\") || !SAFE_PATH.test(candidate)) return fallback;

  return candidate;
}

/** True only for https URLs on an allowlisted host (exact match or a subdomain of an entry starting with a dot). */
export function isAllowedExternalUrl(candidate: string, allowedHosts: readonly string[]): boolean {
  let url: URL;

  try {
    url = new URL(candidate);
  } catch {
    return false;
  }

  if (url.protocol !== "https:" || url.username !== "" || url.password !== "") return false;

  const host = url.hostname.toLowerCase();

  return allowedHosts.some((entry) => {
    const allowed = entry.trim().toLowerCase();

    return allowed.startsWith(".") ? host.endsWith(allowed) && host.length > allowed.length : host === allowed;
  });
}

/** Shows the last four digits only. */
export function maskAccountNumber(value: string): string {
  const digits = value.replace(/\D/g, "");

  return digits.length <= 4 ? digits : `${"•".repeat(Math.min(6, digits.length - 4))}${digits.slice(-4)}`;
}
