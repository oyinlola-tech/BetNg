export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normaliseShopCode(code: string): string {
  return code.trim().toUpperCase();
}

export function normaliseUsername(username: string): string {
  return username.trim().toLowerCase();
}

/** Digits only, keeping a leading `+`: "+234 803 555 0142" and "+2348035550142" are the same number. */
export function normalisePhone(phone: string): string {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/gu, "");

  return trimmed.startsWith("+") ? `+${digits}` : digits;
}
