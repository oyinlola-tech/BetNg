import { View } from "react-native";
import type { MatchStats, MatchSummary, SideStats } from "@betng/ui-core";
import { useTheme } from "../theme";
import { EmptyState } from "./States";
import { Text } from "./Text";

const ROWS: readonly {
  readonly key: keyof SideStats;
  readonly label: string;
  readonly percent?: boolean;
}[] = [
  { key: "possession", label: "Possession", percent: true },
  { key: "shots", label: "Shots" },
  { key: "shotsOnTarget", label: "On target" },
  { key: "corners", label: "Corners" },
  { key: "fouls", label: "Fouls" },
  { key: "offsides", label: "Offsides" },
  { key: "yellowCards", label: "Yellow cards" },
  { key: "redCards", label: "Red cards" },
];

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
      {ROWS.map((row) => {
        const h = stats.home[row.key];
        const a = stats.away[row.key];
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
