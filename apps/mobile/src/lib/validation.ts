/* The same rules as packages/contracts/src/auth, without pulling a schema library into the app. */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function emailError(value: string): string | undefined {
  return EMAIL.test(value.trim()) ? undefined : "Enter a valid email address.";
}

export function passwordError(value: string, mode: "login" | "new"): string | undefined {
  if (mode === "login") return value.length === 0 ? "Enter your password." : undefined;
  if (value.length < 8) return "Use at least 8 characters.";

  return value.length > 128 ? "Keep it under 128 characters." : undefined;
}

export function displayNameError(value: string): string | undefined {
  const length = value.trim().length;

  return length < 2 ? "Enter at least 2 characters." : length > 60 ? "Keep it under 60 characters." : undefined;
}

export function phoneError(value: string): string | undefined {
  const trimmed = value.trim();

  if (trimmed === "") return undefined;
  if (trimmed.length > 20) return "Keep it under 20 characters.";

  return /^[+\d][\d\s-]*$/.test(trimmed) ? undefined : "Use digits only, with an optional +.";
}

export function codeError(value: string): string | undefined {
  return /^\d{6}$/.test(value) ? undefined : "Enter the 6-digit code.";
}
