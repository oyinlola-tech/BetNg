import { createHash } from "node:crypto";

/** `ada@example.com` → `a**@example.com`. Enough to recognise an address in a log, not to read it. */
export function maskEmail(address: string): string {
  const at = address.indexOf("@");

  if (at <= 0) {
    return "***";
  }

  const local = address.slice(0, at);
  const domain = address.slice(at);

  return `${local.slice(0, 1)}${"*".repeat(Math.max(2, local.length - 1))}${domain}`;
}

export function normaliseAddress(address: string): string {
  return address.trim().toLowerCase();
}

/** Suppressions and message lookups are keyed by this, so an address is never an index key. */
export function addressHash(address: string): string {
  return createHash("sha256").update(normaliseAddress(address), "utf8").digest("hex");
}

/**
 * Drops every value the template declared secret, so a verification code or a one-time password is
 * rendered and then forgotten rather than written to a row an operator can read.
 */
export function withoutSecrets(
  variables: Readonly<Record<string, string>>,
  secretVariables: readonly string[],
): Record<string, string> {
  return Object.fromEntries(Object.entries(variables).filter(([key]) => !secretVariables.includes(key)));
}
