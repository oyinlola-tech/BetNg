const HTTPS_URL = /^https:\/\/([a-z0-9.-]+)(?::443)?(\/[^\s]*)?$/i;

/** True only for https URLs on an allowlisted host (exact, or a subdomain of an entry starting with a dot). No credentials, no other schemes. */
export function isAllowedCheckoutUrl(candidate: unknown, allowedHosts: readonly string[]): boolean {
  if (typeof candidate !== "string" || candidate.length > 2048 || /[\s@\\]/.test(candidate)) return false;

  const host = HTTPS_URL.exec(candidate)?.[1]?.toLowerCase();

  if (host === undefined) return false;

  return allowedHosts.some((entry) => {
    const allowed = entry.trim().toLowerCase();

    return allowed.startsWith(".") ? host.endsWith(allowed) && host.length > allowed.length : host === allowed;
  });
}
