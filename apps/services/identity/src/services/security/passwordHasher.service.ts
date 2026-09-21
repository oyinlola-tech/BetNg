import { hashPassword, randomToken, verifyPassword } from "@zudojs/crypto";
import type { PasswordHasher } from "../../interfaces/index.js";

/**
 * scrypt hashing for passwords and PINs.
 *
 * `verifyAgainstNothing` checks the submitted secret against a hash of a
 * random value made at startup. It can never match; it exists so a sign-in for
 * an unknown account costs what one for a known account costs.
 */
export function createPasswordHasher(): PasswordHasher {
  const decoy = randomToken(32).then(async (secret) => (await hashPassword(secret)).encoded);

  return {
    hash: async (secret) => (await hashPassword(secret)).encoded,
    verify: async (secret, encoded) => verifyPassword(secret, encoded),
    verifyAgainstNothing: async (secret) => {
      await verifyPassword(secret, await decoy);
    },
  };
}
