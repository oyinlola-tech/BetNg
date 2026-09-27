import { View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { isSelected, type MatchMarketsView, type MatchSummary } from "@betng/ui-core";
import { quickBetFor, slipSelectionFor } from "../lib/quickBet";
import { useBetSlip } from "../stores/betslip.store";
import { useTheme } from "../theme";
import { Countdown } from "./Countdown";
import { OddsButton } from "./OddsButton";
import { Pressable } from "./Pressable";
import { Skeleton } from "./States";
import { TeamBadge } from "./TeamBadge";
import { Text } from "./Text";

export function QuickBetRow({
  match,
  markets,
  loading,
  onOpen,
}: {
  readonly match: MatchSummary;
  readonly markets: MatchMarketsView | undefined;
  readonly loading: boolean;
  readonly onOpen: () => void;
}): React.JSX.Element {
  const t = useTheme();
  const selections = useBetSlip((s) => s.selections);
  const toggle = useBetSlip((s) => s.toggle);
  const quick = quickBetFor(markets);

  return (
    <View style={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12, gap: 10 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${match.home.name} v ${match.away.name}, all markets`}
        onPress={onOpen}
        style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
      >
        <View style={{ flex: 1, gap: 6 }}>
          {(["home", "away"] as const).map((side) => (
            <View key={side} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <TeamBadge team={match[side]} size={20} />
              <Text variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
                {match[side].name}
              </Text>
            </View>
          ))}
        </View>
        <View style={{ alignItems: "flex-end", gap: 2 }}>
          <Text variant="caps" tone="muted">
            {match.leagueCode} · closes
          </Text>
          <Countdown to={match.bettingClosesAt} variant="caption" style={{ fontWeight: "700" }} />
        </View>
        <ChevronRight size={16} color={t.colors.textMuted} />
      </Pressable>

      {quick !== undefined ? (
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {quick.selections.map((selection) => (
              <OddsButton
                key={selection.id}
                compact
                selection={selection}
                selected={isSelected(selections, selection.id)}
                onPress={() => {
                  toggle(slipSelectionFor(match, quick.market, selection));
                }}
              />
            ))}
          </View>
          {quick.otherMarkets > 0 && (
            <Text variant="caption" tone="muted">
              {quick.market.name} · {String(quick.otherMarkets)} more {quick.otherMarkets === 1 ? "market" : "markets"} inside
            </Text>
          )}
        </View>
      ) : loading ? (
        <Skeleton height={44} radius={t.radius.sm} />
      ) : (
        <Text variant="caption" tone="muted">
          Prices for this match are not available right now.
        </Text>
      )}
    </View>
  );
}
