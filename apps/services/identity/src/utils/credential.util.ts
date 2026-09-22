import { randomFromAlphabet, randomNumericCode } from "@zudojs/crypto";
import { SECURITY } from "../constants/index.js";

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

  if (password.length < SECURITY.OPERATOR_PASSWORD_MIN_LENGTH || pin.length !== SECURITY.TEMPORARY_PIN_DIGITS) {
    throw new Error("Issued operator credentials are shorter than the operator policy allows.");
  }

  return { password, pin };
}
