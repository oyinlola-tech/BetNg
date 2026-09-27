import { useMemo, useState } from "react";
import { View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  canBet,
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
  QuickBetRow,
  Screen,
  SkeletonRows,
  Tabs,
  Text,
} from "../components";
import { useAsync } from "../hooks/useAsync";
import { useQuickBets } from "../hooks/useQuickBets";
import { getDataSource } from "../services/dataSource";
import { useTheme } from "../theme";

type View_ = "OPEN" | "LIVE" | "LEAGUES" | "RESULTS";

const PHASES: Record<Exclude<View_, "LEAGUES">, readonly MatchPhase[]> = {
  OPEN: ["BETTING_OPEN", "BETTING_CLOSED", "SCHEDULED"],
  LIVE: ["LIVE", "HALFTIME"],
  RESULTS: ["FINISHED", "SETTLED"],
};

export function VirtualsScreen(): React.JSX.Element {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [view, setView] = useState<View_>("OPEN");
  const leagues = useAsync(() => getDataSource().listLeagues(), [], 30_000);
  const matches = useAsync(
    () =>
      view === "LEAGUES"
        ? Promise.resolve([] as readonly MatchSummary[])
        : getDataSource().listMatches({ phases: PHASES[view], limit: 40 }),
    [view],
    4000,
  );

  const prices = useQuickBets(view === "OPEN" ? matches.data : undefined);

  // Matches that can take a bet lead the lobby; the ones already closed follow under their own heading.
  const groups = useMemo(() => {
    const map = new Map<string, MatchSummary[]>();
    const closed: MatchSummary[] = [];

    for (const m of matches.data ?? []) {
      if (view === "OPEN" && !canBet(m.phase)) {
        closed.push(m);
        continue;
      }

      const key = `${m.leagueCode} · ${formatMatchday(m.matchday)}`;

      map.set(key, [...(map.get(key) ?? []), m]);
    }

    return closed.length === 0 ? [...map.entries()] : [...map.entries(), ["Starting soon · betting closed", closed] as [string, MatchSummary[]]];
  }, [matches.data, view]);

  return (
    <Screen
      style={{ paddingTop: insets.top + 12 }}
      refreshing={matches.refreshing}
      onRefresh={() => void Promise.all([matches.refresh(), prices.refresh()])}
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
            { value: "OPEN", label: "Bet now" },
            { value: "LIVE", label: "Live" },
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
            title={view === "LIVE" ? "No live matches" : view === "OPEN" ? "No matches open for betting" : "Nothing here yet"}
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
                  {canBet(m.phase) ? (
                    <QuickBetRow
                      match={m}
                      markets={prices.byMatch.get(m.id)}
                      loading={prices.loading}
                      onOpen={() => {
                        navigation.navigate("Match", { matchId: m.id, tab: "MARKETS" });
                      }}
                    />
                  ) : (
                    <MatchRow
                      match={m}
                      onPress={() => {
                        navigation.navigate("Match", { matchId: m.id });
                      }}
                    />
                  )}
                </View>
              ))}
            </Card>
          </View>
        ))
      )}
    </Screen>
  );
}
