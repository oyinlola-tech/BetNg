import { createHash } from "node:crypto";
import type { Logger } from "@betng/service-kit";

const RANGE_URL = "https://api.pwnedpasswords.com/range/";
const TIMEOUT_MS = 3000;

export interface BreachChecker {
  /** `false` when the check is off or could not be completed (fails open, logged). */
  isBreached(password: string): Promise<boolean>;
}

/** HIBP k-anonymity: only the first five hex characters of the SHA-1 leave the service, with padding requested. */
export function createBreachChecker(enabled: boolean, logger: Logger): BreachChecker {
  return {
    isBreached: async (password) => {
      if (!enabled) {
        return false;
      }

      const digest = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
      const prefix = digest.slice(0, 5);
      const suffix = digest.slice(5);

      try {
        const response = await fetch(`${RANGE_URL}${prefix}`, {
          headers: { "add-padding": "true", "user-agent": "betng-identity" },
          redirect: "error",
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });

        if (!response.ok) {
          await response.body?.cancel();
          throw new Error(`HTTP ${String(response.status)}`);
        }

        const body = await response.text();

        return body.split("\n").some((line) => {
          const [candidate, count] = line.trim().split(":");

          return candidate === suffix && Number(count) > 0;
        });
      } catch (error) {
        logger.warn("Password breach check could not be completed; the password was accepted without it", {
          event: "password_breach_check_unavailable",
          error: error instanceof Error ? error.message : String(error),
        });

        return false;
      }
    },
  };
}
