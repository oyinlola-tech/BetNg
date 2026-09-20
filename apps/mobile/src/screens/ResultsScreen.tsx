import { useMemo, useState } from "react";
import { View } from "react-native";
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import type { LeagueId } from "@betng/contracts";
import {
  formatMatchday,
  toLocalDateKey,
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
import type { RootStackParamList } from "../navigation/types";
import { getDataSource } from "../services/dataSource";
import { useTheme } from "../theme";

function shift(key: string, days: number): string {
  const d = new Date(`${key}T12:00:00`);

  d.setDate(d.getDate() + days);

  return toLocalDateKey(d);
}

export function ResultsScreen(): React.JSX.Element {
  const t = useTheme();
  const navigation = useNavigation();
  const params = useRoute<RouteProp<RootStackParamList, "Results">>().params;
  const leagues = useAsync(() => getDataSource().listLeagues(), [], 30_000);
  const [selected, setSelected] = useState<string | undefined>(params.leagueId);
  const leagueId = selected ?? leagues.data?.[0]?.id;
  const today = toLocalDateKey(new Date());
  const [date, setDate] = useState(today);
  const results = useAsync(
    () =>
      leagueId === undefined
        ? Promise.resolve([] as readonly MatchSummary[])
        : getDataSource().listMatches({
            leagueId: leagueId as LeagueId,
            date,
            phases: ["FINISHED", "SETTLED"],
            limit: 48,
          }),
    [leagueId, date],
    10_000,
  );

  const groups = useMemo(() => {
    const map = new Map<string, MatchSummary[]>();

    for (const m of results.data ?? []) {
      const key = `Season ${String(m.season)} · ${formatMatchday(m.matchday)}`;

      map.set(key, [...(map.get(key) ?? []), m]);
    }

    return [...map.entries()];
  }, [results.data]);

  return (
    <Screen
      refreshing={results.refreshing}
      onRefresh={() => void results.refresh()}
    >
      {leagues.data !== undefined && (
        <Tabs
          segmented
          value={leagueId ?? ""}
          onChange={setSelected}
          items={leagues.data.map((l) => ({ value: l.id, label: l.code }))}
        />
      )}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 12,
        }}
      >
        <Pressable
          accessibilityLabel="Previous day"
          onPress={() => {
            setDate((d) => shift(d, -1));
          }}
          style={{ width: 44, alignItems: "center", justifyContent: "center" }}
        >
          <ChevronLeft size={20} color={t.colors.textSecondary} />
        </Pressable>
        <Text variant="bodyStrong">
          {date === today
            ? "Today"
            : date === shift(today, -1)
              ? "Yesterday"
              : new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}
        </Text>
        <Pressable
          accessibilityLabel="Next day"
          disabled={date >= today}
          onPress={() => {
            setDate((d) => shift(d, 1));
          }}
          style={{
            width: 44,
            alignItems: "center",
            justifyContent: "center",
            opacity: date >= today ? 0.3 : 1,
          }}
        >
          <ChevronRight size={20} color={t.colors.textSecondary} />
        </Pressable>
      </View>
      {results.loading && results.data === undefined ? (
        <Card style={{ marginTop: 12, padding: 12 }}>
          <SkeletonRows rows={8} />
        </Card>
      ) : results.error !== undefined && results.data === undefined ? (
        <ErrorState
          error={results.error}
          onRetry={() => void results.refresh()}
        />
      ) : groups.length === 0 ? (
        <Card style={{ marginTop: 12 }}>
          <EmptyState
            title="No results"
            description="No matches finished on this day."
          />
        </Card>
      ) : (
        groups.map(([label, items]) => (
          <View key={label} style={{ marginTop: 14 }}>
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
