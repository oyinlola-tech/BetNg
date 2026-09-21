export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normaliseShopCode(code: string): string {
  return code.trim().toUpperCase();
}

export function normaliseUsername(username: string): string {
  return username.trim().toLowerCase();
}
