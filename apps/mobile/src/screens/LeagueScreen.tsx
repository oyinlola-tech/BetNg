import { useLayoutEffect, useState } from "react";
import { View } from "react-native";
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import type { LeagueId } from "@betng/contracts";
import { formatMatchday } from "@betng/ui-core";
import {
  Card,
  EmptyState,
  ErrorState,
  LeagueTable,
  MatchRow,
  Screen,
  SkeletonRows,
  Tabs,
  Text,
  TeamBadge,
} from "../components";
import { useAsync } from "../hooks/useAsync";
import type { RootStackParamList } from "../navigation/types";
import { getDataSource } from "../services/dataSource";
import { useTheme } from "../theme";

type Section = "TABLE" | "FIXTURES" | "RESULTS" | "SCORERS";

export function LeagueScreen(): React.JSX.Element {
  const t = useTheme();
  const navigation = useNavigation();
  const { leagueId } =
    useRoute<RouteProp<RootStackParamList, "League">>().params;
  const id = leagueId as LeagueId;
  const [section, setSection] = useState<Section>("TABLE");
  const league = useAsync(() => getDataSource().getLeague(id), [id], 30_000);
  const standings = useAsync(
    () => getDataSource().getStandings(id),
    [id],
    15_000,
  );
  const fixtures = useAsync(
    () =>
      getDataSource().listMatches({
        leagueId: id,
        phases: [
          "LIVE",
          "HALFTIME",
          "BETTING_OPEN",
          "BETTING_CLOSED",
          "SCHEDULED",
        ],
      }),
    [id],
    5000,
  );
  const results = useAsync(
    () =>
      getDataSource().listMatches({
        leagueId: id,
        phases: ["FINISHED", "SETTLED"],
        limit: 18,
      }),
    [id],
    8000,
  );
  const scorers = useAsync(
    () => getDataSource().getTopScorers(id),
    [id],
    30_000,
  );

  useLayoutEffect(() => {
    navigation.setOptions({ title: league.data?.code ?? "League" });
  }, [navigation, league.data]);

  const openMatch = (matchId: string): void => {
    navigation.navigate("Match", { matchId });
  };
  const list = (
    items: readonly { readonly id: string }[] | undefined,
    loading: boolean,
    error: unknown,
    render: (m: never) => React.JSX.Element,
    empty: string,
  ): React.JSX.Element =>
    loading && items === undefined ? (
      <View style={{ padding: 12 }}>
        <SkeletonRows rows={6} />
      </View>
    ) : error !== undefined && items === undefined ? (
      <ErrorState error={error} />
    ) : (items ?? []).length === 0 ? (
      <EmptyState title={empty} />
    ) : (
      <>
        {(items ?? []).map((m, i) => (
          <View
            key={m.id}
            style={{
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: t.colors.border,
            }}
          >
            {render(m as never)}
          </View>
        ))}
      </>
    );

  return (
    <Screen>
      {league.data !== undefined && (
        <>
          <Text variant="caps" tone="muted">
            {league.data.country} · Season {league.data.currentSeason} ·{" "}
            {formatMatchday(league.data.currentMatchday)}
          </Text>
          <Text variant="heading">{league.data.name}</Text>
        </>
      )}
      <View style={{ marginTop: 12 }}>
        <Tabs
          segmented
          value={section}
          onChange={setSection}
          items={[
            { value: "TABLE", label: "Table" },
            { value: "FIXTURES", label: "Fixtures" },
            { value: "RESULTS", label: "Results" },
            { value: "SCORERS", label: "Scorers" },
          ]}
        />
      </View>
      <Card style={{ marginTop: 14 }}>
        {section === "TABLE" &&
          (standings.data === undefined ? (
            <View style={{ padding: 12 }}>
              <SkeletonRows rows={10} />
            </View>
          ) : (
            <LeagueTable
              standings={standings.data}
              onTeam={(teamId) => {
                navigation.navigate("Team", { teamId });
              }}
            />
          ))}
        {section === "FIXTURES" &&
          list(
            fixtures.data,
            fixtures.loading,
            fixtures.error,
            (m) => (
              <MatchRow
                match={m}
                onPress={() => {
                  openMatch((m as { id: string }).id);
                }}
              />
            ),
            "No fixtures",
          )}
        {section === "RESULTS" &&
          list(
            results.data,
            results.loading,
            results.error,
            (m) => (
              <MatchRow
                match={m}
                onPress={() => {
                  openMatch((m as { id: string }).id);
                }}
              />
            ),
            "No results yet",
          )}
        {section === "SCORERS" &&
          (scorers.data === undefined ? (
            <View style={{ padding: 12 }}>
              <SkeletonRows rows={6} />
            </View>
          ) : scorers.data.length === 0 ? (
            <EmptyState title="No goals yet this season" />
          ) : (
            scorers.data.map((s, i) => (
              <View
                key={`${s.team.id}-${s.player}`}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: t.colors.border,
                }}
              >
                <Text
                  variant="caption"
                  tone="muted"
                  tabular
                  style={{ width: 20 }}
                >
                  {i + 1}
                </Text>
                <TeamBadge team={s.team} size={22} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong">{s.player}</Text>
                  <Text variant="caption" tone="muted">
                    {s.team.shortName}
                  </Text>
                </View>
                <Text variant="bodyStrong" tabular>
                  {s.goals}
                </Text>
                <Text
                  variant="caption"
                  tone="muted"
                  tabular
                  style={{ width: 28, textAlign: "right" }}
                >
                  {s.assists}a
                </Text>
              </View>
            ))
          ))}
      </Card>
    </Screen>
  );
}
