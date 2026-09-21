import { SECURITY } from "../../constants/index.js";
import { TooManyAttemptsError } from "../../errors/index.js";
import type { LoginThrottle, ThrottleRepository } from "../../interfaces/index.js";
import { sha256Hex } from "../../utils/index.js";

/**
 * Consecutive-failure lockout per sign-in identifier.
 *
 * The key is the identifier that was typed, hashed, whether or not an account
 * answers to it, so the lockout behaves identically for both and says nothing
 * about which addresses exist. Rate limiting by IP address is the gateway's job.
 */
export function createLoginThrottle(throttles: ThrottleRepository): LoginThrottle {
  return {
    assertNotLocked: async (key) => {
      const row = await throttles.find(sha256Hex(key));

      if (row?.lockedUntil !== null && row?.lockedUntil !== undefined && row.lockedUntil > new Date()) {
        throw new TooManyAttemptsError();
      }
    },
    recordFailure: async (key) => {
      const now = new Date();

      await throttles.recordFailure(
        sha256Hex(key),
        SECURITY.MAX_LOGIN_FAILURES,
        new Date(now.getTime() + SECURITY.LOCKOUT_MS),
        now,
      );
    },
    clear: async (key) => throttles.clear(sha256Hex(key)),
  };
}

export const throttleKey = Object.freeze({
  customer: (email: string): string => `CUSTOMER:${email}`,
  admin: (email: string): string => `ADMIN:${email}`,
  cashier: (shopCode: string, username: string): string => `CASHIER:${shopCode}:${username}`,
  cashierPin: (cashierId: string): string => `CASHIER_PIN:${cashierId}`,
});
