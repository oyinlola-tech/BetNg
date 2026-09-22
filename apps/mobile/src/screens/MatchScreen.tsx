import { useEffect, useLayoutEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import { formatMatchday, isInPlay } from "@betng/ui-core";
import {
  Card,
  ErrorState,
  LeagueTable,
  Markets,
  Pressable,
  Scoreboard,
  Screen,
  Skeleton,
  SkeletonRows,
  Stats,
  Tabs,
  Text,
  Timeline,
} from "../components";
import { useAsync } from "../hooks/useAsync";
import { useLiveMatch } from "../hooks/useLiveMatch";
import type { RootStackParamList } from "../navigation/types";
import { getDataSource } from "../services/dataSource";
import { useTheme } from "../theme";

type Tab = "OVERVIEW" | "EVENTS" | "STATS" | "MARKETS";

export function MatchScreen(): React.JSX.Element {
  const t = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, "Match">>();
  const { matchId } = route.params;
  const [tab, setTab] = useState<Tab>(route.params.tab ?? "OVERVIEW");
  const { match, connection, error, resyncing, resync } = useLiveMatch(matchId);
  const [pulling, setPulling] = useState(false);
  const bettable = match?.phase === "BETTING_OPEN";
  const markets = useAsync(
    () => getDataSource().getMatchMarkets(matchId as never),
    [matchId],
    bettable ? 8000 : undefined,
  );
  const standings = useAsync(
    () =>
      match === undefined
        ? Promise.resolve(undefined)
        : getDataSource().getStandings(match.leagueId),
    [match?.leagueId],
    20_000,
  );
  const others = useAsync(
    () => getDataSource().listMatches({ phases: ["LIVE", "HALFTIME"] }),
    [],
    5000,
  );

  useEffect(() => {
    getDataSource().recordView(matchId as never);
  }, [matchId]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title:
        match === undefined
          ? "Match"
          : `${match.leagueCode} · ${formatMatchday(match.matchday)}`,
    });
  }, [navigation, match]);

  if (error !== undefined && match === undefined)
    return (
      <Screen>
        <ErrorState error={new Error(error)} onRetry={resync} />
      </Screen>
    );

  if (match === undefined) {
    return (
      <Screen>
        <Skeleton height={160} radius={8} />
        <View style={{ height: 16 }} />
        <SkeletonRows rows={6} />
      </Screen>
    );
  }

  const live = isInPlay(match.phase);

  const pull = (): void => {
    setPulling(true);
    resync();
    void Promise.all([markets.refresh(), standings.refresh(), others.refresh()]).finally(() => {
      setPulling(false);
    });
  };

  return (
    <Screen padded={false} refreshing={pulling} onRefresh={pull}>
      <View style={{ paddingHorizontal: 16 }}>
        <Scoreboard match={match} />
        {(connection !== "CONNECTED" || resyncing) && (
          <Text
            variant="caption"
            tone="muted"
            align="center"
            style={{ marginBottom: 8 }}
          >
            {resyncing
              ? "Resynchronising…"
              : connection === "OFFLINE"
                ? "Offline · last known state"
                : "Reconnecting…"}
          </Text>
        )}
      </View>

      {live && (others.data ?? []).length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 16,
            gap: 8,
            paddingBottom: 12,
          }}
        >
          {(others.data ?? []).map((m) => {
            const current = m.id === match.id;

            return (
              <Pressable
                key={m.id}
                accessibilityRole="button"
                onPress={() => {
                  navigation.setParams({ matchId: m.id });
                }}
                style={{
                  minHeight: 36,
                  height: 36,
                  paddingHorizontal: 12,
                  borderRadius: t.radius.sm,
                  borderWidth: 1,
                  borderColor: current ? t.colors.brand : t.colors.border,
                  backgroundColor: current
                    ? t.colors.brandSubtle
                    : t.colors.surface,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <View
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: 3,
                    backgroundColor: t.colors.live,
                  }}
                />
                <Text variant="caption" style={{ fontWeight: "600" }}>
                  {m.home.code}{" "}
                  <Text variant="caption" tabular style={{ fontWeight: "800" }}>
                    {m.score.home}–{m.score.away}
                  </Text>{" "}
                  {m.away.code}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      <View style={{ paddingHorizontal: 16 }}>
        <Tabs
          segmented
          value={tab}
          onChange={setTab}
          items={[
            { value: "OVERVIEW", label: "Overview" },
            { value: "EVENTS", label: "Events" },
            { value: "STATS", label: "Stats" },
            { value: "MARKETS", label: "Markets" },
          ]}
        />
        <View style={{ marginTop: 14 }}>
          {tab === "OVERVIEW" && (
            <View style={{ gap: 14 }}>
              <Card style={{ paddingHorizontal: 12 }}>
                <Text variant="caps" tone="muted" style={{ paddingTop: 12 }}>
                  Key events
                </Text>
                <Timeline
                  match={match}
                  events={match.events}
                  keyOnly
                  limit={6}
                />
              </Card>
              <Card style={{ paddingHorizontal: 12 }}>
                <Text variant="caps" tone="muted" style={{ paddingTop: 12 }}>
                  Statistics
                </Text>
                <Stats match={match} stats={match.stats} />
              </Card>
              <Card>
                <Text
                  variant="caps"
                  tone="muted"
                  style={{ padding: 12, paddingBottom: 4 }}
                >
                  Table
                </Text>
                {standings.data === undefined ? (
                  <View style={{ padding: 12 }}>
                    <SkeletonRows rows={5} />
                  </View>
                ) : (
                  <LeagueTable
                    standings={standings.data}
                    highlight={[match.home.id, match.away.id]}
                    onTeam={(id) => {
                      navigation.navigate("Team", { teamId: id });
                    }}
                  />
                )}
              </Card>
            </View>
          )}
          {tab === "EVENTS" && (
            <Card style={{ paddingHorizontal: 12 }}>
              <Timeline match={match} events={match.events} />
            </Card>
          )}
          {tab === "STATS" && (
            <Card style={{ paddingHorizontal: 12 }}>
              <Stats match={match} stats={match.stats} />
            </Card>
          )}
          {tab === "MARKETS" && (
            <Markets
              match={match}
              markets={markets.data}
              loading={markets.loading}
              error={markets.error}
              onRetry={() => void markets.refresh()}
            />
          )}
        </View>
      </View>
    </Screen>
  );
}
