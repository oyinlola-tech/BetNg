/* Stands in for `node:crypto`, which the shared validation packages import for random helpers.
   Metro resolves the import here (metro.config.js). Every helper draws from the device's secure
   source and throws when there is none; nothing falls back to Math.random. */

interface SecureSource {
  getRandomValues<T extends ArrayBufferView>(array: T): T;
  randomUUID?: () => string;
}

const UINT32_RANGE = 0x1_0000_0000;

function source(): SecureSource {
  const crypto = (globalThis as { crypto?: SecureSource }).crypto;

  if (crypto === undefined || typeof crypto.getRandomValues !== "function") {
    throw new Error("No secure random source is available on this device.");
  }

  return crypto;
}

export function getRandomValues<T extends ArrayBufferView>(array: T): T {
  return source().getRandomValues(array);
}

export function randomFillSync<T extends ArrayBufferView>(buffer: T): T {
  return source().getRandomValues(buffer);
}

export function randomBytes(size: number): Uint8Array {
  return source().getRandomValues(new Uint8Array(size));
}

export function randomUUID(): string {
  const crypto = source();

  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const bytes = crypto.getRandomValues(new Uint8Array(16));

  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** `randomInt(max)` or `randomInt(min, max)`, the upper bound excluded. Rejection sampling, so no value is favoured. */
export function randomInt(first: number, second?: number): number {
  const min = second === undefined ? 0 : first;
  const max = second === undefined ? first : second;
  const span = max - min;

  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || span <= 0 || span > UINT32_RANGE) {
    throw new RangeError("randomInt needs integer bounds at most 2^32 apart, with max above min.");
  }

  const limit = UINT32_RANGE - (UINT32_RANGE % span);
  const word = new Uint32Array(1);

  for (;;) {
    source().getRandomValues(word);

    const value = word[0] ?? 0;

    if (value < limit) {
      return min + (value % span);
    }
  }
}

export default { getRandomValues, randomBytes, randomFillSync, randomInt, randomUUID };
