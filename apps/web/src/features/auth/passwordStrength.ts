export type StrengthLevel = 0 | 1 | 2 | 3 | 4;

export interface PasswordStrength {
  readonly level: StrengthLevel;
  readonly label: "Too short" | "Weak" | "Fair" | "Good" | "Strong";
  readonly hint: string | undefined;
}

const COMMON = /^(password|passw0rd|qwerty|letmein|welcome|iloveyou|admin|betng|123456|abc123|football|monkey|dragon)/i;
const LABELS = ["Too short", "Weak", "Fair", "Good", "Strong"] as const;

/** Guidance while typing only; the platform decides what it accepts, including breach checks. */
export function passwordStrength(password: string): PasswordStrength {
  if (password.length < 8) return { level: 0, label: LABELS[0], hint: "Use at least 8 characters." };

  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((pattern) => pattern.test(password)).length;
  let score = (password.length >= 12 ? 2 : 1) + (password.length >= 16 ? 1 : 0) + (classes >= 3 ? 1 : 0) + (classes === 4 ? 1 : 0);

  if (COMMON.test(password) || /(.)\1{3,}/.test(password) || /^(?:0123|1234|abcd|qwer)/i.test(password)) score = Math.min(score, 1);

  const level = Math.max(1, Math.min(4, score)) as StrengthLevel;
  const hint = level >= 3 ? undefined : password.length < 12 ? "Longer is stronger: try a short phrase of unrelated words." : "Mix in capitals, numbers or symbols, and avoid common words.";

  return { level, label: LABELS[level], hint };
}

const BREACH = /breach|compromis|pwned|leak|exposed/i;

/** True when the platform's field message says the password appeared in a known breach. */
export function isBreachMessage(message: string | undefined): boolean {
  return message !== undefined && BREACH.test(message);
}
