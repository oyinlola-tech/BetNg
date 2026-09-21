import { hashPassword, randomToken, verifyPassword } from "@zudojs/crypto";
import type { PasswordHasher } from "../../interfaces/index.js";

/** `verifyAgainstNothing` checks against a hash of a random startup value, so an unknown account costs what a known one costs. */
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
