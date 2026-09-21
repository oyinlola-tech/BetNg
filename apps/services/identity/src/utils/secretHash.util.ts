import { createHash, timingSafeEqual } from "node:crypto";

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** Bound to the verification row. The code's short life and the attempt cap protect it, not this hash. */
export function verificationCodeHash(verificationId: string, code: string): string {
  return sha256Hex(`${verificationId}:${code}`);
}

export function constantTimeEqual(left: string, right: string): boolean {
  const a = createHash("sha256").update(left, "utf8").digest();
  const b = createHash("sha256").update(right, "utf8").digest();

  return timingSafeEqual(a, b);
}
