import { randomBytes, randomInt } from "node:crypto";

const BACKUP_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Eight characters from a 32-letter alphabet (40 bits), shown as ABCD-EFGH. */
export function generateBackupCode(): string {
  const chars = Array.from({ length: 8 }, () => BACKUP_ALPHABET.charAt(randomInt(BACKUP_ALPHABET.length)));

  return `${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}

export function normaliseBackupCode(code: string): string {
  return code.replace(/-/gu, "").toUpperCase();
}

export function isTotpCode(code: string): boolean {
  return /^\d{6}$/u.test(code);
}

export function randomUrlToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sixDigitCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");

  return `${local.slice(0, 1)}***@${domain}`;
}

export function maskPhone(phone: string): string {
  return `***${phone.slice(-3)}`;
}
