import { randomUUID } from "node:crypto";
import { randomNumericCode } from "@zudojs/crypto";
import type { Logger } from "@betng/service-kit";
import type { SecurityConfig } from "../../configs/index.js";
import { SECURITY } from "../../constants/index.js";
import type { VerificationIssuer } from "../../interfaces/index.js";
import { verificationCodeHash } from "../../utils/index.js";

/**
 * Issues e-mail verification codes.
 *
 * This project has no mail server. In development and test the code is written
 * to the log, which is where a developer reads it; in production it is not
 * logged and therefore not delivered, and no route ever returns it.
 */
export function createVerificationIssuer(security: SecurityConfig, logger: Logger): VerificationIssuer {
  return {
    issue: async (repositories, customer, requestId) => {
      const now = new Date();
      const id = randomUUID();
      const code = await randomNumericCode(SECURITY.VERIFICATION_CODE_DIGITS);
      const expiresAt = new Date(now.getTime() + SECURITY.VERIFICATION_TTL_MS);

      await repositories.verifications.invalidateOutstanding(customer.id, now);
      await repositories.verifications.create({
        id,
        customerId: customer.id,
        codeHash: verificationCodeHash(id, code),
        expiresAt,
      });

      if (security.logVerificationCodes) {
        logger.info("Verification code issued", {
          event: "verification_code_issued",
          requestId,
          email: customer.email,
          code,
          expiresAt: expiresAt.toISOString(),
        });
      }

      return { expiresAt };
    },
  };
}
