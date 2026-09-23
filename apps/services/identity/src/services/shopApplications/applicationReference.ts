import { randomBytes } from "node:crypto";

/** Crockford base32 without I, L, O or U: no pair a person can confuse when reading one out. */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

const LENGTH = 16;

/**
 * The only handle an applicant has, and the only thing standing between a guesser and someone else's
 * application — so it is 16 characters of `randomBytes`, about 80 bits, not a sequence. A status lookup
 * still needs the verified address as well.
 */
export function applicationReference(): string {
  const bytes = randomBytes(LENGTH);
  let reference = "";

  for (const byte of bytes) {
    reference += ALPHABET[byte % ALPHABET.length];
  }

  return `BNGA-${reference}`;
}

const STATE_CODES: Readonly<Record<string, string>> = {
  AKWA_IBOM: "AKW",
  CROSS_RIVER: "CRS",
  FCT: "ABJ",
  LAGOS: "LAG",
  NASARAWA: "NAS",
};

/** `LAGOS` → `LAG`, `OYO` → `OYO`, `AKWA_IBOM` → `AKW`. */
export function stateCode(state: string): string {
  return STATE_CODES[state] ?? state.replaceAll("_", "").slice(0, 3).toUpperCase();
}

/** `BNG-LAG-007`. The reviewer may override it; the unique index on `shops.code` is the real guard. */
export function shopCodeFor(state: string, sequence: number): string {
  return `BNG-${stateCode(state)}-${String(sequence).padStart(3, "0")}`;
}

/** `Adaeze Okonkwo` → `adaeze`; the shop's first owner signs in with this. */
export function ownerUsername(applicantName: string): string {
  const first = applicantName.trim().split(/\s+/u)[0] ?? "owner";
  const cleaned = first.toLowerCase().replaceAll(/[^a-z0-9._-]/gu, "");

  return cleaned.length >= 2 ? cleaned.slice(0, 40) : "owner";
}
