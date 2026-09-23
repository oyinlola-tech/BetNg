import { View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Receipt } from "lucide-react-native";
import {
  formatDateTime,
  formatMoney,
  formatOdds,
  type BetView,
} from "@betng/ui-core";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Pressable,
  Screen,
  SkeletonRows,
  Text,
} from "../components";
import { useAccountVersion } from "../hooks/useAccount";
import { useAsync } from "../hooks/useAsync";
import { getDataSource } from "../services/dataSource";
import { useBetSlip } from "../stores/betslip.store";
import { useTheme } from "../theme";

export function BetCard({
  bet,
  onMatch,
}: {
  readonly bet: BetView;
  readonly onMatch: (id: string) => void;
}): React.JSX.Element {
  const t = useTheme();
  const tone =
    bet.status === "WON"
      ? t.colors.success
      : bet.status === "PENDING"
        ? t.colors.brand
        : bet.status === "VOID"
          ? t.colors.warning
          : t.colors.textMuted;

  return (
    <Card>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          padding: 12,
          borderBottomWidth: 1,
          borderBottomColor: t.colors.border,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View
            style={{
              backgroundColor: bet.status === "WON" ? tone : `${tone}22`,
              paddingHorizontal: 6,
              height: 20,
              borderRadius: 3,
              justifyContent: "center",
            }}
          >
            <Text
              variant="caps"
              style={{
                fontSize: 10,
                color: bet.status === "WON" ? "#fff" : tone,
              }}
            >
              {bet.status}
            </Text>
          </View>
          <Text variant="caption" tone="muted">
            {bet.legs.length === 1
              ? "Single"
              : `${String(bet.legs.length)}-fold`}{" "}
            · {formatDateTime(bet.placedAt)}
          </Text>
        </View>
        <Text variant="caption" tabular style={{ fontWeight: "700" }}>
          @ {formatOdds(bet.totalOdds)}
        </Text>
      </View>
      {bet.legs.map((leg) => (
        <Pressable
          key={leg.selectionId}
          onPress={() => {
            onMatch(leg.matchId);
          }}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: t.colors.border,
          }}
        >
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor:
                leg.outcome === "WON"
                  ? t.colors.success
                  : leg.outcome === "LOST"
                    ? t.colors.danger
                    : leg.outcome === "VOID"
                      ? t.colors.warning
                      : t.colors.brand,
            }}
          />
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong" numberOfLines={1}>
              {leg.selectionLabel}{" "}
              <Text variant="body" tone="muted">
                · {leg.marketName}
              </Text>
            </Text>
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {leg.matchLabel}
              {leg.result !== undefined ? ` · ${leg.result}` : ""}
            </Text>
          </View>
          <Text variant="caption" tabular style={{ fontWeight: "700" }}>
            {formatOdds(leg.odds)}
          </Text>
        </Pressable>
      ))}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          padding: 12,
          backgroundColor: t.colors.surfaceSunken,
        }}
      >
        <Text variant="caption" tone="secondary">
          Stake{" "}
          <Text variant="caption" tabular style={{ fontWeight: "700" }}>
            {formatMoney(bet.stake)}
          </Text>
        </Text>
        <Text variant="caption" tone="secondary">
          {bet.status === "PENDING" ? "To return" : "Returned"}{" "}
          <Text
            variant="caption"
            tabular
            tone={bet.status === "WON" ? "success" : "primary"}
            style={{ fontWeight: "700" }}
          >
            {formatMoney(
              bet.status === "PENDING"
                ? bet.potentialPayout
                : (bet.payout ?? 0),
            )}
          </Text>
        </Text>
      </View>
    </Card>
  );
}

export function BetsScreen(): React.JSX.Element {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const version = useAccountVersion();
  const bets = useAsync(() => getDataSource().listBets(), [version], 10_000);
  const setOpen = useBetSlip((s) => s.setOpen);
  const selections = useBetSlip((s) => s.selections.length);
  const open = (bets.data ?? []).filter((b) => b.status === "PENDING");
  const settled = (bets.data ?? []).filter((b) => b.status !== "PENDING");

  return (
    <Screen
      style={{ paddingTop: insets.top + 12 }}
      refreshing={bets.refreshing}
      onRefresh={() => void bets.refresh()}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "space-between",
        }}
      >
        <View>
          <Text variant="caps" tone="muted">
            Virtual football
          </Text>
          <Text variant="heading">Bets</Text>
        </View>
        <Button
          label={selections > 0 ? `Slip (${String(selections)})` : "Slip"}
          size="sm"
          variant="secondary"
          onPress={() => {
            setOpen(true);
          }}
        />
      </View>
      {bets.loading && bets.data === undefined ? (
        <View style={{ marginTop: 16 }}>
          <SkeletonRows rows={6} />
        </View>
      ) : bets.error !== undefined && bets.data === undefined ? (
        <ErrorState error={bets.error} onRetry={() => void bets.refresh()} />
      ) : (bets.data ?? []).length === 0 ? (
        <Card style={{ marginTop: 16 }}>
          <EmptyState
            icon={<Receipt size={20} color={t.colors.textMuted} />}
            title="No bets yet"
            description="Bets you place appear here and settle at full time."
            action={
              <Button
                label="Open the lobby"
                size="sm"
                onPress={() => {
                  navigation.navigate("Tabs", { screen: "Virtuals" });
                }}
              />
            }
          />
        </Card>
      ) : (
        <>
          {open.length > 0 && (
            <Text
              variant="caps"
              tone="muted"
              style={{ marginTop: 16, marginBottom: 8 }}
            >
              Open · {open.length}
            </Text>
          )}
          <View style={{ gap: 10 }}>
            {open.map((b) => (
              <BetCard
                key={b.id}
                bet={b}
                onMatch={(id) => {
                  navigation.navigate("Match", { matchId: id });
                }}
              />
            ))}
          </View>
          {settled.length > 0 && (
            <Text
              variant="caps"
              tone="muted"
              style={{ marginTop: 20, marginBottom: 8 }}
            >
              Settled
            </Text>
          )}
          <View style={{ gap: 10 }}>
            {settled.map((b) => (
              <BetCard
                key={b.id}
                bet={b}
                onMatch={(id) => {
                  navigation.navigate("Match", { matchId: id });
                }}
              />
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}
