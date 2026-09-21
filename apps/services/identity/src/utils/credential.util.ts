import { randomFromAlphabet, randomNumericCode } from "@zudojs/crypto";
import { SECURITY } from "../constants/index.js";

/** No look-alike characters: these are read off a screen and typed at a shop terminal. */
const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

export interface IssuedSecrets {
  readonly password: string;
  readonly pin: string;
}

export async function issueTemporarySecrets(): Promise<IssuedSecrets> {
  const [password, pin] = await Promise.all([
    randomFromAlphabet(SECURITY.TEMPORARY_PASSWORD_LENGTH, PASSWORD_ALPHABET),
    randomNumericCode(SECURITY.TEMPORARY_PIN_DIGITS),
  ]);

  return { password, pin };
}
