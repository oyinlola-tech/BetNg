/** Deterministic randomness. */

/** FNV-1a, 32-bit. */
export function hash(text: string): number {
  let h = 0x811c9dc5;

  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }

  return h >>> 0;
}

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  int(minInclusive: number, maxInclusive: number): number;
  pick<T>(items: readonly T[]): T;
  chance(probability: number): boolean;
  poisson(lambda: number): number;
  shuffle<T>(items: readonly T[]): T[];
}

/** mulberry32. */
export function rng(seed: string | number): Rng {
  let a = typeof seed === "number" ? seed >>> 0 : hash(seed);

  const next = (): number => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (items) => {
      const item = items[Math.floor(next() * items.length)];

      if (item === undefined) throw new Error("pick() on an empty list");

      return item;
    },
    chance: (p) => next() < p,
    poisson: (lambda) => {
      const limit = Math.exp(-lambda);
      let k = 0;
      let p = 1;

      do {
        k += 1;
        p *= next();
      } while (p > limit);

      return k - 1;
    },
    shuffle: (items) => {
      const out = [...items];

      for (let i = out.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        const tmp = out[i] as (typeof out)[number];

        out[i] = out[j] as (typeof out)[number];
        out[j] = tmp;
      }

      return out;
    },
  };
}

export function uuidFrom(name: string): string {
  const r = rng(`uuid:${name}`);
  const hex = (): string => Math.floor(r.next() * 16).toString(16);
  const run = (n: number): string => Array.from({ length: n }, hex).join("");

  // Version 4 nibble and RFC variant bits, so it passes a UUID check.
  const variant = ["8", "9", "a", "b"][Math.floor(r.next() * 4)] ?? "8";

  return `${run(8)}-${run(4)}-4${run(3)}-${variant}${run(3)}-${run(12)}`;
}
