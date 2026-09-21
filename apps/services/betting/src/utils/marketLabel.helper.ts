const MARKET_NAMES: Readonly<Record<string, string>> = Object.freeze({
  MATCH_RESULT: "Match Result",
  DOUBLE_CHANCE: "Double Chance",
  OVER_UNDER: "Over/Under",
  BOTH_TEAMS_TO_SCORE: "Both Teams To Score",
  CORRECT_SCORE: "Correct Score",
  GOAL_SPREAD: "Goal Spread",
});

export function marketLabel(type: string, lineTenths: number | undefined): string {
  const name = MARKET_NAMES[type] ?? type;

  return lineTenths === undefined
    ? name
    : `${name} ${formatTenths(lineTenths)}`;
}

export function parseTenths(text: string): number {
  const match = /^(-?)(\d{1,3})(?:\.(\d))?$/.exec(text.trim());

  if (match === null) {
    throw new Error(`"${text}" is not a one-decimal line.`);
  }

  const magnitude = Number(match[2]) * 10 + Number(match[3] ?? "0");

  return match[1] === "-" ? -magnitude : magnitude;
}

export function formatTenths(tenths: number): string {
  const magnitude = Math.abs(tenths);
  const text = `${String(Math.trunc(magnitude / 10))}.${String(magnitude % 10)}`;

  return tenths < 0 ? `-${text}` : text;
}
