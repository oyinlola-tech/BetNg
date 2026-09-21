import { View } from "react-native";
import type { MatchStats, MatchSummary } from "@betng/ui-core";
import { useTheme } from "../theme";
import { EmptyState } from "./States";
import { Text } from "./Text";

type CountKey = "possession" | "shots" | "shotsOnTarget" | "corners" | "fouls" | "offsides" | "yellowCards" | "redCards";

const COUNTS: readonly { readonly key: CountKey; readonly label: string; readonly percent?: boolean }[] = [
  { key: "possession", label: "Possession", percent: true },
  { key: "shots", label: "Shots" },
  { key: "shotsOnTarget", label: "On target" },
  { key: "corners", label: "Corners" },
  { key: "fouls", label: "Fouls" },
  { key: "offsides", label: "Offsides" },
  { key: "yellowCards", label: "Yellow cards" },
  { key: "redCards", label: "Red cards" },
];

interface StatRow {
  readonly key: string;
  readonly label: string;
  readonly home: number;
  readonly away: number;
  readonly percent: boolean;
}

/* Only what the platform reported: optional metrics appear when both sides carry them. */
function rowsFor(stats: MatchStats): readonly StatRow[] {
  const rows: StatRow[] = COUNTS.map((c) => ({ key: c.key, label: c.label, home: stats.home[c.key], away: stats.away[c.key], percent: c.percent === true }));

  if (stats.home.expectedGoals !== undefined && stats.away.expectedGoals !== undefined) {
    rows.push({ key: "expectedGoals", label: "Expected goals", home: stats.home.expectedGoals, away: stats.away.expectedGoals, percent: false });
  }

  for (const extra of stats.home.extra ?? []) {
    const other = stats.away.extra?.find((e) => e.key === extra.key);

    if (other !== undefined) rows.push({ key: `extra:${extra.key}`, label: extra.label, home: extra.value, away: other.value, percent: extra.unit === "PERCENT" });
  }

  return rows;
}

export function Stats({
  match,
  stats,
}: {
  readonly match: MatchSummary;
  readonly stats: MatchStats | undefined;
}): React.JSX.Element {
  const t = useTheme();

  if (stats === undefined)
    return (
      <EmptyState
        title="Statistics not available yet"
        description="They start once the match kicks off."
      />
    );

  return (
    <View style={{ gap: 14, paddingVertical: 8 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text variant="bodyStrong">{match.home.shortName}</Text>
        <Text variant="bodyStrong">{match.away.shortName}</Text>
      </View>
      {rowsFor(stats).map((row) => {
        const h = row.home;
        const a = row.away;
        const total = h + a;
        const share = total === 0 ? 50 : (h / total) * 100;

        return (
          <View key={row.key}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text
                variant="bodyStrong"
                tabular
                tone={h >= a ? "primary" : "muted"}
              >
                {h}
                {row.percent ? "%" : ""}
              </Text>
              <Text variant="caps" tone="muted">
                {row.label}
              </Text>
              <Text
                variant="bodyStrong"
                tabular
                tone={a >= h ? "primary" : "muted"}
              >
                {a}
                {row.percent ? "%" : ""}
              </Text>
            </View>
            <View
              style={{ flexDirection: "row", gap: 2, marginTop: 6, height: 5 }}
            >
              <View
                style={{
                  flex: 1,
                  backgroundColor: t.colors.surfaceSunken,
                  borderTopLeftRadius: 3,
                  borderBottomLeftRadius: 3,
                  alignItems: "flex-end",
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    width: `${share}%`,
                    height: 5,
                    backgroundColor:
                      h > a ? t.colors.brand : t.colors.borderStrong,
                  }}
                />
              </View>
              <View
                style={{
                  flex: 1,
                  backgroundColor: t.colors.surfaceSunken,
                  borderTopRightRadius: 3,
                  borderBottomRightRadius: 3,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    width: `${100 - share}%`,
                    height: 5,
                    backgroundColor:
                      a > h ? t.colors.brand : t.colors.borderStrong,
                  }}
                />
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}
