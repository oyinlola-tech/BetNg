import { useMemo, useState } from "react";
import { View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  formatMatchday,
  type MatchPhase,
  type MatchSummary,
} from "@betng/ui-core";
import {
  Card,
  EmptyState,
  ErrorState,
  MatchRow,
  Pressable,
  Screen,
  SkeletonRows,
  Tabs,
  Text,
} from "../components";
import { useAsync } from "../hooks/useAsync";
import { getDataSource } from "../services/dataSource";
import { useTheme } from "../theme";

type View_ = "LIVE" | "SOON" | "LEAGUES" | "RESULTS";

const PHASES: Record<Exclude<View_, "LEAGUES">, readonly MatchPhase[]> = {
  LIVE: ["LIVE", "HALFTIME"],
  SOON: ["BETTING_OPEN", "BETTING_CLOSED", "SCHEDULED"],
  RESULTS: ["FINISHED", "SETTLED"],
};

export function VirtualsScreen(): React.JSX.Element {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [view, setView] = useState<View_>("LIVE");
  const leagues = useAsync(() => getDataSource().listLeagues(), [], 30_000);
  const matches = useAsync(
    () =>
      view === "LEAGUES"
        ? Promise.resolve([] as readonly MatchSummary[])
        : getDataSource().listMatches({ phases: PHASES[view], limit: 40 }),
    [view],
    4000,
  );

  const groups = useMemo(() => {
    const map = new Map<string, MatchSummary[]>();

    for (const m of matches.data ?? []) {
      const key = `${m.leagueCode} · ${formatMatchday(m.matchday)}`;

      map.set(key, [...(map.get(key) ?? []), m]);
    }

    return [...map.entries()];
  }, [matches.data]);

  return (
    <Screen
      style={{ paddingTop: insets.top + 12 }}
      refreshing={matches.refreshing}
      onRefresh={() => void matches.refresh()}
    >
      <Text variant="caps" tone="muted">
        Lobby
      </Text>
      <Text variant="heading">Virtual Football</Text>
      <View style={{ marginTop: 12 }}>
        <Tabs
          segmented
          value={view}
          onChange={setView}
          items={[
            { value: "LIVE", label: "Live" },
            { value: "SOON", label: "Soon" },
            { value: "LEAGUES", label: "Leagues" },
            { value: "RESULTS", label: "Results" },
          ]}
        />
      </View>

      {view === "LEAGUES" ? (
        <View style={{ gap: 10, marginTop: 16 }}>
          {(leagues.data ?? []).map((l) => (
            <Card key={l.id}>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  navigation.navigate("League", { leagueId: l.id });
                }}
                style={{
                  padding: 14,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: t.radius.sm,
                    backgroundColor: t.colors.surfaceSunken,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text variant="caption" style={{ fontWeight: "800" }}>
                    {l.code}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong">{l.name}</Text>
                  <Text variant="caption" tone="muted">
                    {l.teamCount} clubs · Season {l.currentSeason} ·{" "}
                    {formatMatchday(l.currentMatchday)} of {l.matchdays}
                  </Text>
                </View>
              </Pressable>
            </Card>
          ))}
        </View>
      ) : matches.loading && matches.data === undefined ? (
        <Card style={{ marginTop: 16, padding: 12 }}>
          <SkeletonRows rows={6} />
        </Card>
      ) : matches.error !== undefined && matches.data === undefined ? (
        <ErrorState
          error={matches.error}
          onRetry={() => void matches.refresh()}
        />
      ) : groups.length === 0 ? (
        <Card style={{ marginTop: 16 }}>
          <EmptyState
            title={view === "LIVE" ? "No live matches" : "Nothing here yet"}
            description={
              view === "LIVE" ? "The next kick-off is moments away." : undefined
            }
          />
        </Card>
      ) : (
        groups.map(([label, items]) => (
          <View key={label} style={{ marginTop: 16 }}>
            <Text variant="caps" tone="muted" style={{ marginBottom: 6 }}>
              {label}
            </Text>
            <Card>
              {items.map((m, i) => (
                <View
                  key={m.id}
                  style={{
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: t.colors.border,
                  }}
                >
                  <MatchRow
                    match={m}
                    onPress={() => {
                      navigation.navigate("Match", { matchId: m.id });
                    }}
                  />
                </View>
              ))}
            </Card>
          </View>
        ))
      )}
    </Screen>
  );
}
