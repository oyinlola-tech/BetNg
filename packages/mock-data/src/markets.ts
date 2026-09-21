import type { MarketId, SelectionId } from "@betng/contracts";
import type {
  MarketKind,
  MarketView,
  MatchMarketsView,
  OddsTrend,
  SelectionView,
} from "@betng/ui-core";
import { expectedGoals } from "./simulate.js";
import { hash, uuidFrom } from "./prng.js";
import { statusAt, type FixtureRef } from "./season.js";

const OVERROUND = 1.07;
const MAX_GOALS = 8;

function poisson(lambda: number, k: number): number {
  let p = Math.exp(-lambda);

  for (let i = 1; i <= k; i += 1) p *= lambda / i;

  return p;
}

/** P(home scores h, away scores a) for every pair up to MAX_GOALS. */
function grid(lambdaHome: number, lambdaAway: number): number[][] {
  const ph = Array.from({ length: MAX_GOALS + 1 }, (_, k) =>
    poisson(lambdaHome, k),
  );
  const pa = Array.from({ length: MAX_GOALS + 1 }, (_, k) =>
    poisson(lambdaAway, k),
  );

  return ph.map((h) => pa.map((a) => h * a));
}

function sum(
  g: number[][],
  predicate: (h: number, a: number) => boolean,
): number {
  let total = 0;

  for (let h = 0; h <= MAX_GOALS; h += 1) {
    for (let a = 0; a <= MAX_GOALS; a += 1) {
      if (predicate(h, a)) total += g[h]?.[a] ?? 0;
    }
  }

  return total;
}

interface Priced {
  readonly code: string;
  readonly label: string;
  readonly shortLabel: string;
  readonly probability: number;
}

interface MarketSpec {
  readonly kind: MarketKind;
  readonly name: string;
  readonly line?: number;
  readonly columns: number;
  readonly outcomes: readonly Priced[];
}

function specs(fixture: FixtureRef, drift: number): readonly MarketSpec[] {
  const xg = expectedGoals(fixture.home, fixture.away);
  const g = grid(xg.home * (1 + drift), xg.away * (1 - drift));
  const home = fixture.home.shortName;
  const away = fixture.away.shortName;

  const list: MarketSpec[] = [
    {
      kind: "MATCH_RESULT",
      name: "Match Result",
      columns: 3,
      outcomes: [
        {
          code: "HOME",
          label: home,
          shortLabel: "1",
          probability: sum(g, (h, a) => h > a),
        },
        {
          code: "DRAW",
          label: "Draw",
          shortLabel: "X",
          probability: sum(g, (h, a) => h === a),
        },
        {
          code: "AWAY",
          label: away,
          shortLabel: "2",
          probability: sum(g, (h, a) => h < a),
        },
      ],
    },
    {
      kind: "DOUBLE_CHANCE",
      name: "Double Chance",
      columns: 3,
      outcomes: [
        {
          code: "HOME_DRAW",
          label: `${home} or Draw`,
          shortLabel: "1X",
          probability: sum(g, (h, a) => h >= a),
        },
        {
          code: "HOME_AWAY",
          label: `${home} or ${away}`,
          shortLabel: "12",
          probability: sum(g, (h, a) => h !== a),
        },
        {
          code: "DRAW_AWAY",
          label: `Draw or ${away}`,
          shortLabel: "X2",
          probability: sum(g, (h, a) => h <= a),
        },
      ],
    },
  ];

  for (const line of [1.5, 2.5, 3.5]) {
    const tag = String(line).replace(".", "_");

    list.push({
      kind: "OVER_UNDER",
      name: `Total Goals ${String(line)}`,
      line,
      columns: 2,
      outcomes: [
        {
          code: `OVER_${tag}`,
          label: `Over ${String(line)}`,
          shortLabel: `O ${String(line)}`,
          probability: sum(g, (h, a) => h + a > line),
        },
        {
          code: `UNDER_${tag}`,
          label: `Under ${String(line)}`,
          shortLabel: `U ${String(line)}`,
          probability: sum(g, (h, a) => h + a < line),
        },
      ],
    });
  }

  list.push({
    kind: "BOTH_TEAMS_TO_SCORE",
    name: "Both Teams To Score",
    columns: 2,
    outcomes: [
      {
        code: "YES",
        label: "Yes",
        shortLabel: "Yes",
        probability: sum(g, (h, a) => h > 0 && a > 0),
      },
      {
        code: "NO",
        label: "No",
        shortLabel: "No",
        probability: sum(g, (h, a) => h === 0 || a === 0),
      },
    ],
  });

  list.push({
    kind: "GOAL_SPREAD",
    name: "Goal Spread",
    line: -1.5,
    columns: 2,
    outcomes: [
      {
        code: "HOME_MINUS_1_5",
        label: `${home} -1.5`,
        shortLabel: `${fixture.home.code} -1.5`,
        probability: sum(g, (h, a) => h - a >= 2),
      },
      {
        code: "AWAY_PLUS_1_5",
        label: `${away} +1.5`,
        shortLabel: `${fixture.away.code} +1.5`,
        probability: sum(g, (h, a) => h - a <= 1),
      },
    ],
  });

  const cs: Priced[] = [];

  for (let h = 0; h <= 3; h += 1) {
    for (let a = 0; a <= 3; a += 1) {
      cs.push({
        code: `CS_${String(h)}_${String(a)}`,
        label: `${String(h)} – ${String(a)}`,
        shortLabel: `${String(h)}–${String(a)}`,
        probability: g[h]?.[a] ?? 0,
      });
    }
  }

  cs.push({
    code: "CS_OTHER",
    label: "Any other score",
    shortLabel: "Other",
    probability: sum(g, (h, a) => h > 3 || a > 3),
  });
  list.push({
    kind: "CORRECT_SCORE",
    name: "Correct Score",
    columns: 4,
    outcomes: cs,
  });

  return list;
}

function price(probability: number, marketTotal: number): number {
  const implied = (probability / marketTotal) * OVERROUND;
  const odds = 1 / Math.max(implied, 0.004);

  return Math.min(250, Math.max(1.01, Math.round(odds * 100) / 100));
}

/** A small, slow, deterministic drift so prices move between refreshes. */
function driftAt(matchId: string, now: number): number {
  const bucket = Math.floor(now / 45_000);

  return ((hash(`${matchId}:${String(bucket)}`) % 1000) / 1000 - 0.5) * 0.06;
}

/**
 * Every market for a fixture, priced at `now`.
 *
 * @endpoint GET /api/v1/matches/:id/odds → MatchOdds
 */
export function marketsFor(fixture: FixtureRef, now: number): MatchMarketsView {
  const status = statusAt(fixture, now);
  const marketStatus =
    status === "BETTING_OPEN"
      ? "OPEN"
      : status === "COMPLETED"
        ? "SETTLED"
        : "SUSPENDED";

  const current = specs(fixture, driftAt(fixture.matchId, now));
  const previous = specs(fixture, driftAt(fixture.matchId, now - 45_000));

  const markets = current.map((spec, index): MarketView => {
    const marketId = uuidFrom(
      `market:${fixture.matchId}:${spec.kind}:${String(spec.line ?? "")}`,
    ) as MarketId;
    const total = spec.outcomes.reduce((acc, o) => acc + o.probability, 0);
    const previousTotal =
      previous[index]?.outcomes.reduce((acc, o) => acc + o.probability, 0) ??
      total;

    return {
      id: marketId,
      matchId: fixture.matchId,
      kind: spec.kind,
      name: spec.name,
      ...(spec.line === undefined ? {} : { line: spec.line }),
      status: marketStatus,
      columns: spec.columns,
      selections: spec.outcomes.map((o, i): SelectionView => {
        const odds = price(o.probability, total);
        const before = previous[index]?.outcomes[i];
        const previousOdds =
          before === undefined
            ? odds
            : price(before.probability, previousTotal);
        const trend: OddsTrend =
          odds > previousOdds + 0.005
            ? "UP"
            : odds < previousOdds - 0.005
              ? "DOWN"
              : "STEADY";

        return {
          id: uuidFrom(`selection:${marketId}:${o.code}`) as SelectionId,
          marketId,
          code: o.code,
          label: o.label,
          shortLabel: o.shortLabel,
          odds,
          probability: Math.round((o.probability / total) * 1000) / 1000,
          trend,
        };
      }),
    };
  });

  return {
    matchId: fixture.matchId,
    markets,
    generatedAt: new Date(now).toISOString(),
  };
}

export function settleSelection(
  kind: MarketKind,
  code: string,
  score: { home: number; away: number },
): "WON" | "LOST" {
  const { home: h, away: a } = score;
  const won = ((): boolean => {
    switch (kind) {
      case "MATCH_RESULT":
        return code === "HOME" ? h > a : code === "DRAW" ? h === a : h < a;
      case "DOUBLE_CHANCE":
        return code === "HOME_DRAW"
          ? h >= a
          : code === "HOME_AWAY"
            ? h !== a
            : h <= a;
      case "OVER_UNDER": {
        const line = Number.parseFloat(
          code.replace(/^(OVER|UNDER)_/, "").replace("_", "."),
        );

        return code.startsWith("OVER") ? h + a > line : h + a < line;
      }
      case "BOTH_TEAMS_TO_SCORE":
        return code === "YES" ? h > 0 && a > 0 : h === 0 || a === 0;
      case "CORRECT_SCORE": {
        if (code === "CS_OTHER") return h > 3 || a > 3;

        const [, hs, as] = code.split("_");

        return Number(hs) === h && Number(as) === a;
      }
      case "GOAL_SPREAD":
        return code === "HOME_MINUS_1_5" ? h - a >= 2 : h - a <= 1;
    }
  })();

  return won ? "WON" : "LOST";
}
