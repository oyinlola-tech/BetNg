import { useCallback, useMemo, useState } from "react";
import { View } from "react-native";
import { Lock } from "lucide-react-native";
import {
  MARKET_GROUP_LABEL,
  canBet,
  groupMarkets,
  isSelected,
  marketTitle,
  sortMarkets,
  type MarketGroupKey,
  type MarketView,
  type MatchMarketsView,
  type MatchSummary,
  type SelectionView,
} from "@betng/ui-core";
import { useBetSlip } from "../stores/betslip.store";
import { useTheme } from "../theme";
import { Card } from "./Card";
import { Countdown } from "./Countdown";
import { OddsButton } from "./OddsButton";
import { EmptyState, ErrorState, Skeleton } from "./States";
import { Tabs } from "./Tabs";
import { Text } from "./Text";

export function Markets({
  match,
  markets,
  loading,
  error,
  onRetry,
}: {
  readonly match: MatchSummary;
  readonly markets: MatchMarketsView | undefined;
  readonly loading: boolean;
  readonly error: unknown;
  readonly onRetry: () => void;
}): React.JSX.Element {
  const t = useTheme();
  const selections = useBetSlip((s) => s.selections);
  const toggle = useBetSlip((s) => s.toggle);
  const bettable = canBet(match.phase);
  const [group, setGroup] = useState<MarketGroupKey | "ALL">("ALL");

  const onToggle = useCallback(
    (market: MarketView, selection: SelectionView) => {
      toggle({
        selectionId: selection.id,
        marketId: market.id,
        matchId: match.id,
        marketKind: market.kind,
        marketName: market.name,
        selectionLabel: selection.label,
        odds: selection.odds,
        matchLabel: `${match.home.name} v ${match.away.name}`,
        leagueCode: match.leagueCode,
        kickoffAt: match.kickoffAt,
      });
    },
    [toggle, match],
  );

  const all = useMemo(() => markets?.markets ?? [], [markets]);

  /*
   * A full catalogue is dozens of markets, which is unreadable on a phone as
   * one list. The groups come from the platform's catalogue, so a group this
   * match has no markets for is never offered as an empty tab.
   */
  const groups = useMemo(() => groupMarkets(all), [all]);
  const tabs = useMemo(
    () => [
      { value: "ALL" as const, label: "All", count: all.length },
      ...groups.map((g) => ({
        value: g.key,
        label: MARKET_GROUP_LABEL[g.key],
        count: g.markets.length,
      })),
    ],
    [all, groups],
  );

  const shown = useMemo(
    () =>
      group === "ALL"
        ? sortMarkets(all)
        : (groups.find((g) => g.key === group)?.markets ?? []),
    [all, groups, group],
  );

  const rows = useMemo(() => {
    const out: {
      readonly market: MarketView;
      readonly chunks: readonly (readonly SelectionView[])[];
    }[] = [];

    for (const market of shown) {
      const chunks: (readonly SelectionView[])[] = [];
      const size = Math.min(market.columns, 4);

      for (let i = 0; i < market.selections.length; i += size)
        chunks.push(market.selections.slice(i, i + size));

      out.push({ market, chunks });
    }

    return out;
  }, [shown]);

  if (error !== undefined)
    return <ErrorState error={error} onRetry={onRetry} />;

  return (
    <View style={{ gap: 12 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text variant="caps" tone="muted">
          {bettable
            ? "Betting open"
            : match.phase === "SCHEDULED"
              ? "Opens with the next matchday"
              : "Markets suspended"}
        </Text>
        {bettable && (
          <Text variant="caption" tone="muted">
            Closes in{" "}
            <Countdown
              to={match.bettingClosesAt}
              variant="caption"
              style={{ fontWeight: "700" }}
            />
          </Text>
        )}
      </View>
      {all.length > 0 && tabs.length > 2 && (
        <Tabs items={tabs} value={group} onChange={setGroup} />
      )}
      {loading && markets === undefined ? (
        [0, 1, 2].map((i) => (
          <Card key={i} style={{ padding: 12, gap: 10 }}>
            <Skeleton height={14} width={120} />
            <View style={{ flexDirection: "row", gap: 6 }}>
              <Skeleton height={44} />
              <Skeleton height={44} />
              <Skeleton height={44} />
            </View>
          </Card>
        ))
      ) : rows.length === 0 ? (
        <EmptyState
          title="No markets"
          description="Nothing is priced for this match right now."
        />
      ) : (
        rows.map(({ market, chunks }) => {
          const locked = market.status !== "OPEN";

          return (
            <Card key={market.id}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: t.colors.border,
                }}
              >
                <Text variant="bodyStrong">{marketTitle(market)}</Text>
                {locked && (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Lock size={12} color={t.colors.textMuted} />
                    <Text variant="caption" tone="muted">
                      {market.status === "SETTLED" ? "Settled" : "Suspended"}
                    </Text>
                  </View>
                )}
              </View>
              <View style={{ padding: 8, gap: 6 }}>
                {chunks.map((chunk, i) => (
                  <View key={i} style={{ flexDirection: "row", gap: 6 }}>
                    {chunk.map((s) => (
                      <OddsButton
                        key={s.id}
                        selection={s}
                        selected={isSelected(selections, s.id)}
                        disabled={locked}
                        compact={market.kind === "CORRECT_SCORE"}
                        onPress={() => {
                          onToggle(market, s);
                        }}
                      />
                    ))}
                  </View>
                ))}
              </View>
            </Card>
          );
        })
      )}
    </View>
  );
}
