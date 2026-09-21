const REDACTED = "[redacted]";
const MAX_DEPTH = 6;
const MAX_STRING = 2_000;

const SENSITIVE_KEY =
  /(pass(word|code|phrase)?|^pin$|pin[-_]?code|otp|totp|token|secret|authori[sz]ation|cookie|api[-_]?key|private[-_]?key|signature|bvn|^nin$|cvv|cvc|card[-_]?number|account[-_]?number|backup[-_]?codes?|verification[-_]?code|push[-_]?token|session[-_]?id)/i;
const CODE_KEY = /^codes?$/i;
const ENUM_VALUE = /^[A-Z][A-Z0-9_]{2,}$/;

const STRING_RULES: readonly (readonly [RegExp, string])[] = [
  [/\bBearer\s+[^\s,;"']+/gi, "Bearer [redacted]"],
  [/\bBasic\s+[A-Za-z0-9+/=]{8,}/g, "Basic [redacted]"],
  [/\beyJ[\w-]+\.[\w-]+\.[\w-]+/g, "[redacted-jwt]"],
  [/Expo(nent)?PushToken\[[^\]]*\]/g, "[redacted-push-token]"],
  [/([?&#](?:access_token|refresh_token|id_token|token|code|password|pin|otp|secret|signature)=)[^&#\s]*/gi, `$1${REDACTED}`],
  [/((?:password|passcode|pin|otp|token|secret|code)\s*[:=]\s*)["']?[^\s"',;&]+/gi, `$1${REDACTED}`],
  [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]"],
  [/\b\d{6,19}\b/g, "[redacted-number]"],
];

export function redactString(value: string): string {
  let out = value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;

  for (const [pattern, replacement] of STRING_RULES) out = out.replace(pattern, replacement);

  return out;
}

function sensitive(key: string, value: unknown): boolean {
  if (CODE_KEY.test(key)) return !(typeof value === "string" && ENUM_VALUE.test(value));

  return SENSITIVE_KEY.test(key);
}

/** A copy safe to hand to any crash or log sink: credentials, codes and personal identifiers removed. */
export function redact(value: unknown, depth = 0, seen: WeakSet<object> = new WeakSet()): unknown {
  if (typeof value === "string") return redactString(value);
  if (value === null || typeof value !== "object") return typeof value === "function" || typeof value === "symbol" ? undefined : value;
  if (depth >= MAX_DEPTH) return "[truncated]";
  if (seen.has(value)) return "[circular]";

  seen.add(value);

  if (value instanceof Error) {
    const code = (value as { code?: unknown }).code;

    return {
      name: value.name,
      message: redactString(value.message),
      ...(typeof code === "string" && ENUM_VALUE.test(code) ? { code } : {}),
      ...(value.stack === undefined ? {} : { stack: redactString(value.stack) }),
    };
  }

  if (Array.isArray(value)) return value.slice(0, 50).map((item) => redact(item, depth + 1, seen));

  const out: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(value)) {
    out[key] = sensitive(key, item) ? REDACTED : redact(item, depth + 1, seen);
  }

  return out;
}
