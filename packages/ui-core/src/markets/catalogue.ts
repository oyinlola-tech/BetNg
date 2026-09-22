import type { MarketGroupKey, MarketKind, MarketView } from "../types/index.js";

export interface MarketShape {
  readonly name: string;
  readonly group: MarketGroupKey;
  readonly columns: number;
  /** Lower sorts first inside its group. */
  readonly rank: number;
}

/*
 * The platform owns the market catalogue. This table is presentation only: how a
 * kind is named, grouped, laid out and ordered. A kind missing from it still
 * renders — see `marketShape` — so the platform can publish a new market type
 * without a client release.
 */
const KNOWN: Readonly<Record<string, MarketShape>> = {
  MATCH_RESULT: { name: "Match Result", group: "MAIN", columns: 3, rank: 0 },
  DOUBLE_CHANCE: { name: "Double Chance", group: "MAIN", columns: 3, rank: 1 },
  DRAW_NO_BET: { name: "Draw No Bet", group: "MAIN", columns: 2, rank: 2 },

  OVER_UNDER: { name: "Total Goals", group: "GOALS", columns: 2, rank: 0 },
  BOTH_TEAMS_TO_SCORE: { name: "Both Teams To Score", group: "GOALS", columns: 2, rank: 1 },
  ODD_EVEN: { name: "Odd or Even Goals", group: "GOALS", columns: 2, rank: 2 },
  GOAL_BAND: { name: "Goal Bands", group: "GOALS", columns: 3, rank: 3 },

  TEAM_TOTAL: { name: "Team Goals", group: "TEAMS", columns: 2, rank: 0 },
  TEAM_TO_SCORE: { name: "Team To Score", group: "TEAMS", columns: 2, rank: 1 },
  CLEAN_SHEET: { name: "Clean Sheet", group: "TEAMS", columns: 2, rank: 2 },
  TEAM_TO_SCORE_FIRST: { name: "First Team To Score", group: "TEAMS", columns: 3, rank: 3 },

  HALF_TIME_RESULT: { name: "Half Time Result", group: "HALF", columns: 3, rank: 0 },
  HALF_TIME_DOUBLE_CHANCE: { name: "Half Time Double Chance", group: "HALF", columns: 3, rank: 1 },
  HALF_TIME_OVER_UNDER: { name: "Half Time Goals", group: "HALF", columns: 2, rank: 2 },
  HALF_TIME_FULL_TIME: { name: "Half Time / Full Time", group: "HALF", columns: 3, rank: 3 },

  CORRECT_SCORE: { name: "Correct Score", group: "SCORE", columns: 3, rank: 0 },
  HALF_TIME_CORRECT_SCORE: { name: "Half Time Correct Score", group: "SCORE", columns: 3, rank: 1 },
  WINNING_MARGIN: { name: "Winning Margin", group: "SCORE", columns: 3, rank: 2 },

  GOAL_SPREAD: { name: "Goal Spread", group: "HANDICAP", columns: 2, rank: 0 },
  ASIAN_HANDICAP: { name: "Asian Handicap", group: "HANDICAP", columns: 2, rank: 1 },

  TOTAL_CORNERS: { name: "Total Corners", group: "SPECIALS", columns: 2, rank: 0 },
  TEAM_CORNERS: { name: "Team Corners", group: "SPECIALS", columns: 2, rank: 1 },
  TOTAL_CARDS: { name: "Total Cards", group: "SPECIALS", columns: 2, rank: 2 },
  FIRST_GOAL_METHOD: { name: "First Goal Method", group: "SPECIALS", columns: 2, rank: 3 },
};

/** The order groups are offered in, from the everyday bet to the exotic. */
export const MARKET_GROUP_ORDER: readonly MarketGroupKey[] = [
  "MAIN",
  "GOALS",
  "TEAMS",
  "HALF",
  "SCORE",
  "HANDICAP",
  "SPECIALS",
  "OTHER",
];

export const MARKET_GROUP_LABEL: Readonly<Record<MarketGroupKey, string>> = {
  MAIN: "Main",
  GOALS: "Goals",
  TEAMS: "Teams",
  HALF: "Half",
  SCORE: "Score",
  HANDICAP: "Handicap",
  SPECIALS: "Specials",
  OTHER: "More",
};

const UNKNOWN_RANK = 900;

/*
 * Grouping a kind this build has never seen. The platform's own `group` wins
 * when it sends one; this only runs when it does not. Order matters: a
 * half-time corners market belongs under Half before Specials, and anything
 * naming a half belongs there before its subject is considered.
 */
const GROUP_HINTS: readonly (readonly [RegExp, MarketGroupKey])[] = [
  [/HALF_TIME|HALFTIME|^HT_|_HT_|FIRST_HALF|SECOND_HALF/, "HALF"],
  [/CORNER|CARD|BOOKING|PLAYER|REFEREE|METHOD|PENALTY|SUBSTITUT/, "SPECIALS"],
  [/CORRECT_SCORE|MARGIN|SCORECAST|EXACT/, "SCORE"],
  [/HANDICAP|SPREAD/, "HANDICAP"],
  [/TEAM|CLEAN_SHEET|HOME_|AWAY_/, "TEAMS"],
  [/GOAL|OVER_UNDER|TOTAL|SCORE|ODD_EVEN/, "GOALS"],
  [/RESULT|CHANCE|WINNER|NO_BET/, "MAIN"],
];

function inferGroup(kind: MarketKind): MarketGroupKey {
  for (const [pattern, group] of GROUP_HINTS) {
    if (pattern.test(kind)) return group;
  }

  return "OTHER";
}

/** `TEAM_TOTAL_GOALS` reads as "Team Total Goals" rather than as a constant. */
function humanise(kind: MarketKind): string {
  return kind
    .split(/[_\s]+/)
    .filter((word) => word !== "")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

/*
 * A two- or three-way market reads best in as many columns; a long list of
 * selections reads best in three. Four sits as two rows of two rather than a
 * ragged three.
 */
function inferColumns(selectionCount: number): number {
  if (selectionCount <= 3) return Math.max(selectionCount, 1);

  return selectionCount === 4 ? 2 : 3;
}

/** How to present a market kind, whether or not this build knows it. */
export function marketShape(
  kind: MarketKind,
  selectionCount = 3,
): MarketShape {
  return (
    KNOWN[kind] ?? {
      name: humanise(kind),
      group: inferGroup(kind),
      columns: inferColumns(selectionCount),
      rank: UNKNOWN_RANK,
    }
  );
}

export function isKnownMarketKind(kind: MarketKind): boolean {
  return kind in KNOWN;
}

/** The market's title, with its line when the name does not already carry it. */
export function marketTitle(
  market: Pick<MarketView, "name" | "line">,
): string {
  return market.line === undefined || market.name.includes(String(market.line))
    ? market.name
    : `${market.name} ${String(market.line)}`;
}

export interface MarketGroupView {
  readonly key: MarketGroupKey;
  readonly label: string;
  readonly markets: readonly MarketView[];
}

function order(market: MarketView): number {
  return marketShape(market.kind, market.selections.length).rank;
}

/** Within a group: catalogue rank first, then line, then name, so lines read 0.5, 1.5, 2.5. */
export function sortMarkets(
  markets: readonly MarketView[],
): readonly MarketView[] {
  return [...markets].sort(
    (a, b) =>
      order(a) - order(b) ||
      (a.line ?? 0) - (b.line ?? 0) ||
      a.name.localeCompare(b.name),
  );
}

/** Markets by group, in catalogue order, dropping groups the match has no markets for. */
export function groupMarkets(
  markets: readonly MarketView[],
): readonly MarketGroupView[] {
  return MARKET_GROUP_ORDER.flatMap((key) => {
    const members = markets.filter(
      (market) =>
        (market.group ?? marketShape(market.kind, market.selections.length).group) === key,
    );

    return members.length === 0
      ? []
      : [{ key, label: MARKET_GROUP_LABEL[key], markets: sortMarkets(members) }];
  });
}
