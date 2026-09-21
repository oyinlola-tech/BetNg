/* Code 39: nine elements per character (bar, space, bar, …), three of them wide. "n" is narrow, "w" is wide. */
const PATTERNS: Readonly<Record<string, string>> = {
  "0": "nnnwwnwnn", "1": "wnnwnnnnw", "2": "nnwwnnnnw", "3": "wnwwnnnnn", "4": "nnnwwnnnw",
  "5": "wnnwwnnnn", "6": "nnwwwnnnn", "7": "nnnwnnwnw", "8": "wnnwnnwnn", "9": "nnwwnnwnn",
  A: "wnnnnwnnw", B: "nnwnnwnnw", C: "wnwnnwnnn", D: "nnnnwwnnw", E: "wnnnwwnnn",
  F: "nnwnwwnnn", G: "nnnnnwwnw", H: "wnnnnwwnn", I: "nnwnnwwnn", J: "nnnnwwwnn",
  K: "wnnnnnnww", L: "nnwnnnnww", M: "wnwnnnnwn", N: "nnnnwnnww", O: "wnnnwnnwn",
  P: "nnwnwnnwn", Q: "nnnnnnwww", R: "wnnnnnwwn", S: "nnwnnnwwn", T: "nnnnwnwwn",
  U: "wwnnnnnnw", V: "nwwnnnnnw", W: "wwwnnnnnn", X: "nwnnwnnnw", Y: "wwnnwnnnn",
  Z: "nwwnwnnnn", "-": "nwnnnnwnw", ".": "wwnnnnwnn", " ": "nwwnnnwnn", "*": "nwnnwnwnn",
};

const NARROW = 1;
const WIDE = 3;

export interface Code39Bar {
  readonly x: number;
  readonly width: number;
}

export interface Code39 {
  readonly bars: readonly Code39Bar[];
  readonly width: number;
}

/** Bars for a reference a scanner can read back, or undefined when it holds a character Code 39 cannot carry. */
export function encodeCode39(reference: string): Code39 | undefined {
  const text = reference.trim().toUpperCase();

  if (text === "" || [...text].some((c) => c === "*" || PATTERNS[c] === undefined)) return undefined;

  const bars: Code39Bar[] = [];
  let x = 0;

  for (const char of `*${text}*`) {
    const pattern = PATTERNS[char] as string;

    [...pattern].forEach((element, index) => {
      const width = element === "w" ? WIDE : NARROW;

      if (index % 2 === 0) bars.push({ x, width });
      x += width;
    });

    x += NARROW;
  }

  return { bars, width: x - NARROW };
}
