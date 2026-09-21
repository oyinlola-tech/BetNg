import { randomToken } from "@zudojs/crypto";
import type { SecurityConfig } from "../../configs/index.js";
import { SECURITY } from "../../constants/index.js";
import type { SessionKind } from "../../generated/prisma/client.js";
import type { SessionIssuer } from "../../interfaces/index.js";
import { sha256Hex } from "../../utils/index.js";

const HOUR_MS = 3_600_000;

/**
 * Opens sessions. The token leaves the service once, in the sign-in answer;
 * only its SHA-256 is stored, so a copy of the table opens nothing.
 */
export function createSessionIssuer(security: SecurityConfig): SessionIssuer {
  const ttlHours: Readonly<Record<SessionKind, number>> = {
    CUSTOMER: security.customerSessionTtlHours,
    CASHIER: security.cashierSessionTtlHours,
    ADMIN: security.adminSessionTtlHours,
  };

  return {
    issue: async (repositories, kind, subjectId) => {
      const token = await randomToken(SECURITY.SESSION_TOKEN_BYTES);

      const session = await repositories.sessions.create({
        kind,
        subjectId,
        tokenHash: sha256Hex(token),
        expiresAt: new Date(Date.now() + ttlHours[kind] * HOUR_MS),
      });

      return { token, session };
    },
  };
}
