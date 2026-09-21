/** A unique key for one logical operation, reused on its retries. Uniqueness matters here, not secrecy. */
export function createOperationKey(): string {
  const uuid = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID;

  if (typeof uuid === "function") return uuid.call((globalThis as { crypto?: unknown }).crypto);

  const hex = (length: number): string => Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join("");

  return `${hex(8)}-${hex(4)}-4${hex(3)}-${"89ab"[Math.floor(Math.random() * 4)] ?? "8"}${hex(3)}-${Date.now().toString(16).padStart(12, "0").slice(-12)}`;
}
