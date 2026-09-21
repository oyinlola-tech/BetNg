import { createHash, timingSafeEqual } from "node:crypto";

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * The stored form of a verification code.
 *
 * Bound to the verification row, so the same six digits issued twice do not
 * share a hash. A six-digit space is small; what protects the code is its
 * fifteen-minute life and the attempt cap, not this hash.
 */
export function verificationCodeHash(verificationId: string, code: string): string {
  return sha256Hex(`${verificationId}:${code}`);
}

export function constantTimeEqual(left: string, right: string): boolean {
  const a = createHash("sha256").update(left, "utf8").digest();
  const b = createHash("sha256").update(right, "utf8").digest();

  return timingSafeEqual(a, b);
}
