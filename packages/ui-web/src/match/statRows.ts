import type { ExtraStat, MatchStats, SideStats } from "@betng/ui-core";

export type StatUnit = "PERCENT" | "COUNT" | "DECIMAL";

export interface StatRow {
  readonly key: string;
  readonly label: string;
  readonly home: number | undefined;
  readonly away: number | undefined;
  readonly unit: StatUnit;
}

type CoreKey = Exclude<keyof SideStats, "extra">;

const CORE: readonly {
  readonly key: CoreKey;
  readonly label: string;
  readonly unit: StatUnit;
}[] = [
  { key: "possession", label: "Possession", unit: "PERCENT" },
  { key: "shots", label: "Shots", unit: "COUNT" },
  { key: "shotsOnTarget", label: "Shots on target", unit: "COUNT" },
  { key: "corners", label: "Corners", unit: "COUNT" },
  { key: "fouls", label: "Fouls", unit: "COUNT" },
  { key: "offsides", label: "Offsides", unit: "COUNT" },
  { key: "yellowCards", label: "Yellow cards", unit: "COUNT" },
  { key: "redCards", label: "Red cards", unit: "COUNT" },
  { key: "expectedGoals", label: "Expected goals (xG)", unit: "DECIMAL" },
];

/** The platform's types promise numbers, but a partial payload must not become a zero. */
function reported(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function extraRows(
  home: readonly ExtraStat[],
  away: readonly ExtraStat[],
): readonly StatRow[] {
  const awayByKey = new Map(away.map((stat) => [stat.key, stat]));
  const homeKeys = new Set(home.map((stat) => stat.key));
  const rows: StatRow[] = home.map((stat) => ({
    key: `extra:${stat.key}`,
    label: stat.label,
    home: reported(stat.value),
    away: reported(awayByKey.get(stat.key)?.value),
    unit: stat.unit ?? "COUNT",
  }));

  for (const stat of away) {
    if (homeKeys.has(stat.key)) continue;

    rows.push({
      key: `extra:${stat.key}`,
      label: stat.label,
      home: undefined,
      away: reported(stat.value),
      unit: stat.unit ?? "COUNT",
    });
  }

  return rows;
}

/** Every metric the platform reported for at least one side. Nothing is zero-filled. */
export function statRows(
  stats: MatchStats,
  only?: readonly string[],
): readonly StatRow[] {
  const core: StatRow[] = CORE.map((metric) => ({
    key: metric.key,
    label: metric.label,
    home: reported(stats.home[metric.key]),
    away: reported(stats.away[metric.key]),
    unit: metric.unit,
  }));
  const rows = [
    ...core,
    ...extraRows(stats.home.extra ?? [], stats.away.extra ?? []),
  ].filter((row) => row.home !== undefined || row.away !== undefined);

  if (only === undefined) return rows;

  return only.flatMap((key) => rows.filter((row) => row.key === key));
}

export function formatStat(value: number | undefined, unit: StatUnit): string {
  if (value === undefined) return "–";
  if (unit === "PERCENT") return `${String(value)}%`;
  if (unit === "DECIMAL") return value.toFixed(2);

  return String(value);
}
