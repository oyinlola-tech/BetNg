import { ScrollView, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell, Wallet } from "lucide-react-native";
import { formatMoney, formatOdds } from "@betng/ui-core";
import {
  BrandLogo,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LiveMatchCard,
  MatchRow,
  Pressable,
  Screen,
  SectionHeader,
  Skeleton,
  SkeletonRows,
  Text,
  UpcomingCard,
} from "../components";
import { useAccountVersion } from "../hooks/useAccount";
import { useAsync } from "../hooks/useAsync";
import { useAuth } from "../hooks/useAuth";
import { getDataSource } from "../services/dataSource";
import { useTheme } from "../theme";

export function HomeScreen(): React.JSX.Element {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const version = useAccountVersion();
  const live = useAsync(
    () => getDataSource().listMatches({ phases: ["LIVE", "HALFTIME"] }),
    [],
    3000,
  );
  const soon = useAsync(
    () =>
      getDataSource().listMatches({
        phases: ["BETTING_OPEN", "BETTING_CLOSED"],
        limit: 6,
      }),
    [],
    5000,
  );
  const recent = useAsync(
    () =>
      getDataSource().listMatches({
        phases: ["FINISHED", "SETTLED"],
        limit: 6,
      }),
    [],
    8000,
  );
  const leagues = useAsync(() => getDataSource().listLeagues(), [], 30_000);
  const { isAuthenticated, openAuth } = useAuth();
  const wallet = useAsync(
    () => (isAuthenticated ? getDataSource().getWallet() : Promise.resolve(undefined)),
    [version, isAuthenticated],
    15_000,
  );
  const notifications = useAsync(
    () => (isAuthenticated ? getDataSource().listNotifications() : Promise.resolve([])),
    [version, isAuthenticated],
    10_000,
  );
  const bets = useAsync(
    () => (isAuthenticated ? getDataSource().listBets() : Promise.resolve([])),
    [version, isAuthenticated],
    10_000,
  );
  const openBets = (bets.data ?? []).filter((b) => b.status === "PENDING");
  const unread = notifications.data?.filter((n) => !n.read).length ?? 0;
  const openMatch = (matchId: string): void => {
    navigation.navigate("Match", { matchId });
  };

  return (
    <Screen
      padded={false}
      style={{ paddingTop: insets.top + 8 }}
      refreshing={live.refreshing}
      onRefresh={() =>
        void Promise.all([live.refresh(), soon.refresh(), recent.refresh()])
      }
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          marginBottom: 6,
        }}
      >
        <BrandLogo size={28} />
        <View style={{ flex: 1 }} />
        {isAuthenticated ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Wallet"
              onPress={() => {
                navigation.navigate("Wallet");
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 10,
                height: 36,
                borderRadius: t.radius.sm,
                borderWidth: 1,
                borderColor: t.colors.border,
                backgroundColor: t.colors.surface,
              }}
            >
              <Wallet size={14} color={t.colors.textMuted} />
              <Text variant="caption" tabular style={{ fontWeight: "700" }}>
                {wallet.data === undefined
                  ? "—"
                  : formatMoney(wallet.data.available)}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Notifications${unread > 0 ? `, ${String(unread)} unread` : ""}`}
              onPress={() => {
                navigation.navigate("Notifications");
              }}
              style={{
                width: 40,
                height: 40,
                alignItems: "center",
                justifyContent: "center",
                marginLeft: 4,
              }}
            >
              <Bell size={20} color={t.colors.textSecondary} />
              {unread > 0 && (
                <View
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: t.colors.live,
                  }}
                />
              )}
            </Pressable>
          </>
        ) : (
          <Button
            label="Log in"
            size="sm"
            onPress={() => {
              openAuth("login");
            }}
          />
        )}
      </View>

      {openBets.length > 0 && (
        <View style={{ paddingHorizontal: 16 }}>
          <SectionHeader
            eyebrow="Your account"
            title="Current bets"
            onPress={() => {
              navigation.navigate("Tabs", { screen: "Bets" });
            }}
          />
          <Card>
            {openBets.slice(0, 2).map((bet, i) => (
              <Pressable
                key={bet.id}
                accessibilityRole="button"
                accessibilityLabel={`Open bet, ${String(bet.legs.length)} selections, returns ${formatMoney(bet.potentialPayout)}`}
                onPress={() => {
                  navigation.navigate("Tabs", { screen: "Bets" });
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingHorizontal: 14,
                  height: 56,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: t.colors.border,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong" numberOfLines={1}>
                    {bet.legs.length === 1 ? (bet.legs[0]?.selectionLabel ?? "Single") : `${String(bet.legs.length)}-fold accumulator`}
                  </Text>
                  <Text variant="caption" tone="muted" numberOfLines={1}>
                    {bet.legs.length === 1 ? bet.legs[0]?.matchLabel : `Stake ${formatMoney(bet.stake)}`} · @ {formatOdds(bet.totalOdds)}
                  </Text>
                </View>
                <Text variant="bodyStrong" tabular>
                  {formatMoney(bet.potentialPayout)}
                </Text>
              </Pressable>
            ))}
          </Card>
        </View>
      )}

      <View style={{ paddingHorizontal: 16 }}>
        <SectionHeader
          eyebrow="Virtual football"
          title="Live now"
          onPress={() => {
            navigation.navigate("Tabs", { screen: "Live" });
          }}
        />
      </View>
      {live.loading && live.data === undefined ? (
        <View style={{ paddingHorizontal: 16 }}>
          <Skeleton height={150} radius={8} />
        </View>
      ) : live.error !== undefined && live.data === undefined ? (
        <ErrorState error={live.error} onRetry={() => void live.refresh()} />
      ) : (live.data ?? []).length === 0 ? (
        <Card style={{ marginHorizontal: 16 }}>
          <EmptyState
            title="No matches in play"
            description="The next kick-off is moments away."
          />
        </Card>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
          snapToInterval={296}
          decelerationRate="fast"
        >
          {(live.data ?? []).map((m) => (
            <LiveMatchCard
              key={m.id}
              match={m}
              width={286}
              onPress={() => {
                openMatch(m.id);
              }}
            />
          ))}
        </ScrollView>
      )}

      <View style={{ paddingHorizontal: 16 }}>
        <SectionHeader
          title="Starting soon"
          onPress={() => {
            navigation.navigate("Tabs", { screen: "Virtuals" });
          }}
          linkLabel="Lobby"
        />
      </View>
      {soon.loading && soon.data === undefined ? (
        <View style={{ paddingHorizontal: 16 }}>
          <Skeleton height={120} radius={8} />
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
          snapToInterval={250}
          decelerationRate="fast"
        >
          {(soon.data ?? []).map((m) => (
            <UpcomingCard
              key={m.id}
              match={m}
              width={240}
              onPress={() => {
                openMatch(m.id);
              }}
            />
          ))}
        </ScrollView>
      )}

      <View style={{ paddingHorizontal: 16 }}>
        <SectionHeader title="Leagues" />
        <View style={{ flexDirection: "row", gap: 10 }}>
          {(leagues.data ?? []).map((l) => (
            <Card key={l.id} style={{ flex: 1 }}>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  navigation.navigate("League", { leagueId: l.id });
                }}
                style={{ padding: 12, gap: 4 }}
              >
                <Text variant="caps" tone="secondary">
                  {l.code}
                </Text>
                <Text variant="bodyStrong" numberOfLines={2}>
                  {l.name}
                </Text>
                <Text variant="caption" tone="muted">
                  S{l.currentSeason} · MD{" "}
                  {String(l.currentMatchday).padStart(2, "0")}
                </Text>
              </Pressable>
            </Card>
          ))}
        </View>

        <SectionHeader
          title="Recent results"
          onPress={() => {
            navigation.navigate("Results", {});
          }}
        />
        <Card>
          {recent.loading && recent.data === undefined ? (
            <View style={{ padding: 12 }}>
              <SkeletonRows rows={4} />
            </View>
          ) : (recent.data ?? []).length === 0 ? (
            <EmptyState title="No results yet" />
          ) : (
            (recent.data ?? []).map((m, i) => (
              <View
                key={m.id}
                style={{
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: t.colors.border,
                }}
              >
                <MatchRow
                  match={m}
                  showLeague
                  onPress={() => {
                    openMatch(m.id);
                  }}
                />
              </View>
            ))
          )}
        </Card>
      </View>
    </Screen>
  );
}
