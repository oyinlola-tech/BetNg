import { useLayoutEffect } from "react";
import { View } from "react-native";
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import type { LeagueId, TeamId } from "@betng/contracts";
import {
  Card,
  EmptyState,
  ErrorState,
  FormPips,
  MatchRow,
  Screen,
  SectionHeader,
  Skeleton,
  SkeletonRows,
  TeamBadge,
  Text,
} from "../components";
import { useAsync } from "../hooks/useAsync";
import type { RootStackParamList } from "../navigation/types";
import { getDataSource } from "../services/dataSource";
import { useTheme } from "../theme";

export function TeamScreen(): React.JSX.Element {
  const t = useTheme();
  const navigation = useNavigation();
  const { teamId } = useRoute<RouteProp<RootStackParamList, "Team">>().params;
  const team = useAsync(
    () => getDataSource().getTeam(teamId as TeamId),
    [teamId],
  );
  const standings = useAsync(
    () =>
      team.data === undefined
        ? Promise.resolve(undefined)
        : getDataSource().getStandings(team.data.leagueId as LeagueId),
    [team.data?.leagueId],
    20_000,
  );
  const row = standings.data?.rows.find((r) => r.team.id === teamId);
  const recent = useAsync(
    () =>
      getDataSource().listMatches({
        teamId: teamId as TeamId,
        phases: ["FINISHED", "SETTLED"],
        limit: 5,
      }),
    [teamId],
    10_000,
  );
  const upcoming = useAsync(
    () =>
      getDataSource().listMatches({
        teamId: teamId as TeamId,
        phases: [
          "LIVE",
          "HALFTIME",
          "BETTING_OPEN",
          "BETTING_CLOSED",
          "SCHEDULED",
        ],
        limit: 2,
      }),
    [teamId],
    5000,
  );

  useLayoutEffect(() => {
    navigation.setOptions({ title: team.data?.shortName ?? "Team" });
  }, [navigation, team.data]);

  if (team.error !== undefined)
    return (
      <Screen>
        <ErrorState error={team.error} onRetry={() => void team.refresh()} />
      </Screen>
    );
  if (team.data === undefined)
    return (
      <Screen>
        <Skeleton height={120} radius={8} />
        <View style={{ height: 16 }} />
        <SkeletonRows rows={5} />
      </Screen>
    );

  const d = team.data;
  const stat = (
    label: string,
    value: string | number | undefined,
  ): React.JSX.Element => (
    <View
      key={label}
      style={{
        flex: 1,
        minWidth: "45%",
        backgroundColor: t.colors.surface,
        padding: 12,
      }}
    >
      <Text variant="caps" tone="muted">
        {label}
      </Text>
      <Text variant="title" tabular style={{ marginTop: 2 }}>
        {value ?? "–"}
      </Text>
    </View>
  );

  return (
    <Screen>
      <Card
        style={{
          padding: 16,
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
        }}
      >
        <TeamBadge team={d} size={56} />
        <View style={{ flex: 1 }}>
          <Text variant="heading">{d.name}</Text>
          <Text variant="caption" tone="muted">
            {d.city} · {d.stadium}
          </Text>
          <Text variant="caption" tone="muted">
            Founded {d.founded} · {d.manager}
          </Text>
        </View>
      </Card>
      <View style={{ flexDirection: "row", marginTop: 12, gap: 10 }}>
        <Card style={{ flex: 1, padding: 12, alignItems: "center" }}>
          <Text variant="caps" tone="muted">
            Position
          </Text>
          <Text variant="heading" tabular>
            {row?.position ?? "–"}
          </Text>
        </Card>
        <Card style={{ flex: 1, padding: 12, alignItems: "center" }}>
          <Text variant="caps" tone="muted">
            Points
          </Text>
          <Text variant="heading" tabular>
            {row?.points ?? "–"}
          </Text>
        </Card>
        <Card
          style={{
            flex: 1,
            padding: 12,
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <Text variant="caps" tone="muted">
            Form
          </Text>
          <FormPips form={row?.form ?? []} />
        </Card>
      </View>
      <SectionHeader title="Season" />
      <Card
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 1,
          backgroundColor: t.colors.border,
        }}
      >
        {stat("Played", row?.played)}
        {stat("Won", row?.won)}
        {stat("Drawn", row?.drawn)}
        {stat("Lost", row?.lost)}
        {stat("Goals for", row?.goalsFor)}
        {stat("Goals against", row?.goalsAgainst)}
      </Card>
      <SectionHeader title="Next" />
      <Card>
        {upcoming.data === undefined ? (
          <View style={{ padding: 12 }}>
            <SkeletonRows rows={2} />
          </View>
        ) : upcoming.data.length === 0 ? (
          <EmptyState title="No upcoming fixtures" />
        ) : (
          upcoming.data.map((m, i) => (
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
          ))
        )}
      </Card>
      <SectionHeader title="Recent" />
      <Card>
        {recent.data === undefined ? (
          <View style={{ padding: 12 }}>
            <SkeletonRows rows={4} />
          </View>
        ) : recent.data.length === 0 ? (
          <EmptyState title="No results yet" />
        ) : (
          recent.data.map((m, i) => (
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
          ))
        )}
      </Card>
      <SectionHeader title="Squad" />
      <Card>
        {d.squad.map((p, i) => (
          <View
            key={p.id}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              paddingHorizontal: 12,
              paddingVertical: 9,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: t.colors.border,
            }}
          >
            <Text
              variant="caption"
              tone="muted"
              tabular
              style={{ width: 22, textAlign: "right" }}
            >
              {p.shirt}
            </Text>
            <View
              style={{
                width: 28,
                borderRadius: 3,
                backgroundColor: t.colors.surfaceSunken,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "700",
                  color: t.colors.textSecondary,
                }}
              >
                {p.position}
              </Text>
            </View>
            <Text variant="body" style={{ fontWeight: "500" }}>
              {p.name}
            </Text>
          </View>
        ))}
      </Card>
    </Screen>
  );
}
