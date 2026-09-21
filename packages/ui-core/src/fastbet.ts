/** Fastbet: a cashier types "<event> <code>" (e.g. `3 1`, `7X`, `10 GG`, `4 O2.5`) instead of clicking a cell. Several bets separate with commas. */

import type { MarketKind } from "./types/index.js";

export interface FastbetPick {
  readonly event: number;
  readonly kind: MarketKind;
  /** The platform's selection code inside that market, e.g. `HOME`, `OVER_2_5`. */
  readonly selectionCode: string;
  readonly line?: number;
  /** The code as a cashier reads it back, e.g. `O2.5`. */
  readonly label: string;
}

export type FastbetResult = { readonly ok: true; readonly picks: readonly FastbetPick[] } | { readonly ok: false; readonly error: string };

const FIXED: Readonly<Record<string, { readonly kind: MarketKind; readonly selectionCode: string }>> = {
  "1": { kind: "MATCH_RESULT", selectionCode: "HOME" },
  X: { kind: "MATCH_RESULT", selectionCode: "DRAW" },
  "2": { kind: "MATCH_RESULT", selectionCode: "AWAY" },
  "1X": { kind: "DOUBLE_CHANCE", selectionCode: "HOME_DRAW" },
  "12": { kind: "DOUBLE_CHANCE", selectionCode: "HOME_AWAY" },
  X2: { kind: "DOUBLE_CHANCE", selectionCode: "DRAW_AWAY" },
  GG: { kind: "BOTH_TEAMS_TO_SCORE", selectionCode: "YES" },
  NG: { kind: "BOTH_TEAMS_TO_SCORE", selectionCode: "NO" },
};

const TOTALS = /^(O|OV|OVER|U|UN|UNDER)(\d)\.?5$/;
const ENTRY = /^(\d{1,2})\s*[-/:]?\s*([A-Z0-9.]+)$/;

export const FASTBET_CODES: readonly string[] = ["1", "X", "2", "1X", "12", "X2", "GG", "NG", "O2.5", "U2.5"];

function parseCode(raw: string): Omit<FastbetPick, "event"> | undefined {
  const fixed = FIXED[raw];

  if (fixed !== undefined) return { ...fixed, label: raw };

  const totals = TOTALS.exec(raw);

  if (totals === null) return undefined;

  const over = (totals[1] as string).startsWith("O");
  const goals = totals[2] as string;

  return { kind: "OVER_UNDER", line: Number(`${goals}.5`), selectionCode: `${over ? "OVER" : "UNDER"}_${goals}_5`, label: `${over ? "O" : "U"}${goals}.5` };
}

export function parseFastbet(input: string, eventCount: number): FastbetResult {
  const entries = input
    .toUpperCase()
    .split(/[,;+]/)
    .map((part) => part.trim())
    .filter((part) => part !== "");

  if (entries.length === 0) return { ok: false, error: "Type an event number and a code, e.g. 3 1 or 7 GG." };

  const picks: FastbetPick[] = [];

  for (const entry of entries) {
    const match = ENTRY.exec(entry);

    if (match === null) return { ok: false, error: `“${entry}” is not an event number followed by a code.` };

    const event = Number(match[1]);

    if (event < 1 || event > eventCount) return { ok: false, error: `There is no event ${String(event)} this week. Events run 1 to ${String(eventCount)}.` };

    const code = parseCode(match[2] as string);

    if (code === undefined) return { ok: false, error: `“${match[2] as string}” is not a code. Use ${FASTBET_CODES.join(", ")}.` };

    picks.push({ event, ...code });
  }

  return { ok: true, picks };
}
