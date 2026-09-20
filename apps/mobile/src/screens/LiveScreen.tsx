import { View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Radio } from "lucide-react-native";
import {
  Card,
  EmptyState,
  ErrorState,
  LiveMatchCard,
  Screen,
  SectionHeader,
  Skeleton,
  Text,
  UpcomingCard,
} from "../components";
import { useAsync } from "../hooks/useAsync";
import { getDataSource } from "../services/dataSource";
import { useTheme } from "../theme";

export function LiveScreen(): React.JSX.Element {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const live = useAsync(
    () => getDataSource().listMatches({ phases: ["LIVE", "HALFTIME"] }),
    [],
    3000,
  );
  const next = useAsync(
    () =>
      getDataSource().listMatches({
        phases: ["BETTING_OPEN", "BETTING_CLOSED"],
        limit: 4,
      }),
    [],
    5000,
  );

  return (
    <Screen
      style={{ paddingTop: insets.top + 12 }}
      refreshing={live.refreshing}
      onRefresh={() => void live.refresh()}
    >
      <Text variant="caps" tone="muted">
        In play
      </Text>
      <Text variant="heading">Live</Text>
      <View style={{ gap: 10, marginTop: 14 }}>
        {live.loading && live.data === undefined ? (
          <>
            <Skeleton height={150} radius={8} />
            <Skeleton height={150} radius={8} />
          </>
        ) : live.error !== undefined && live.data === undefined ? (
          <ErrorState error={live.error} onRetry={() => void live.refresh()} />
        ) : (live.data ?? []).length === 0 ? (
          <Card>
            <EmptyState
              icon={<Radio size={20} color={t.colors.textMuted} />}
              title="No matches in play"
              description="The next matchday kicks off shortly."
            />
          </Card>
        ) : (
          (live.data ?? []).map((m) => (
            <LiveMatchCard
              key={m.id}
              match={m}
              onPress={() => {
                navigation.navigate("Match", { matchId: m.id });
              }}
            />
          ))
        )}
      </View>
      <SectionHeader
        title="Up next"
        onPress={() => {
          navigation.navigate("Tabs", { screen: "Virtuals" });
        }}
      />
      <View style={{ gap: 10 }}>
        {(next.data ?? []).map((m) => (
          <UpcomingCard
            key={m.id}
            match={m}
            onPress={() => {
              navigation.navigate("Match", { matchId: m.id });
            }}
          />
        ))}
      </View>
    </Screen>
  );
}
