import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Receipt, Trash2, X } from "lucide-react-native";
import {
  QUICK_STAKES,
  STAKE_LIMITS,
  formatMoney,
  formatMoneyCompact,
  formatOdds,
  parseStakeInput,
  slipTotals,
  validateSlip,
} from "@betng/ui-core";
import { useAccountVersion } from "../hooks/useAccount";
import { useAsync } from "../hooks/useAsync";
import { presentError } from "../lib/errors";
import { getDataSource } from "../services/dataSource";
import { useBetSlip } from "../stores/betslip.store";
import { useTheme } from "../theme";
import { Button } from "./Button";
import { Pressable } from "./Pressable";
import { EmptyState } from "./States";
import { Text } from "./Text";

export function BetSlipSheet({
  onPlaced,
}: {
  readonly onPlaced?: (message: string) => void;
}): React.JSX.Element {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { open, setOpen, selections, stake, remove, clear, setStake } =
    useBetSlip();
  const version = useAccountVersion();
  const wallet = useAsync(() => getDataSource().getWallet(), [version, open]);
  const [stakeText, setStakeText] = useState(() => (stake / 100).toString());
  const [placing, setPlacing] = useState(false);
  const [feedback, setFeedback] = useState<
    { readonly tone: "danger" | "success"; readonly text: string } | undefined
  >(undefined);
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slide, {
      toValue: open ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [open, slide]);

  const totals = useMemo(
    () => slipTotals(selections, stake),
    [selections, stake],
  );
  const available = wallet.data?.available ?? Number.POSITIVE_INFINITY;
  const problem = validateSlip(selections, stake, available);

  const updateStake = (text: string): void => {
    setStakeText(text);
    setStake(parseStakeInput(text));
  };

  const submit = async (): Promise<void> => {
    setPlacing(true);
    setFeedback(undefined);

    try {
      const bet = await getDataSource().placeBet({ selections, stake });

      clear();
      setOpen(false);
      onPlaced?.(
        `Simulated bet placed · returns ${formatMoney(bet.potentialPayout)}`,
      );
    } catch (error) {
      setFeedback({ tone: "danger", text: presentError(error).message });
    } finally {
      setPlacing(false);
    }
  };

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={() => {
        setOpen(false);
      }}
    >
      <Pressable
        accessibilityLabel="Close bet slip"
        onPress={() => {
          setOpen(false);
        }}
        style={{ flex: 1, backgroundColor: t.colors.overlay }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Animated.View
          style={{
            backgroundColor: t.colors.surfaceElevated,
            borderTopLeftRadius: t.radius.lg,
            borderTopRightRadius: t.radius.lg,
            maxHeight: "88%",
            paddingBottom: insets.bottom,
            transform: [
              {
                translateY: slide.interpolate({
                  inputRange: [0, 1],
                  outputRange: [40, 0],
                }),
              },
            ],
          }}
        >
          <View style={{ alignItems: "center", paddingTop: 8 }}>
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: t.colors.borderStrong,
              }}
            />
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderBottomWidth: 1,
              borderBottomColor: t.colors.border,
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Receipt size={16} color={t.colors.textMuted} />
              <Text variant="title">Bet slip</Text>
              {selections.length > 0 && (
                <Text
                  variant="caption"
                  tone="brand"
                  tabular
                  style={{ fontWeight: "700" }}
                >
                  {selections.length}
                </Text>
              )}
            </View>
            {selections.length > 0 ? (
              <Pressable
                onPress={clear}
                accessibilityRole="button"
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  minHeight: 32,
                }}
              >
                <Trash2 size={14} color={t.colors.textMuted} />
                <Text variant="caption" tone="muted">
                  Clear all
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => {
                  setOpen(false);
                }}
                accessibilityLabel="Close"
                style={{ minHeight: 32, justifyContent: "center" }}
              >
                <X size={18} color={t.colors.textMuted} />
              </Pressable>
            )}
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 16 }}
          >
            {selections.length === 0 ? (
              <EmptyState
                icon={<Receipt size={20} color={t.colors.textMuted} />}
                title="Your slip is empty"
                description="Tap any odds to add a selection. One selection per match."
              />
            ) : (
              selections.map((s) => (
                <View
                  key={s.selectionId}
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: 12,
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: t.colors.border,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong" numberOfLines={1}>
                      {s.selectionLabel}
                    </Text>
                    <Text variant="caption" tone="secondary" numberOfLines={1}>
                      {s.marketName}
                    </Text>
                    <Text variant="caption" tone="muted" numberOfLines={1}>
                      {s.matchLabel} · {s.leagueCode}
                    </Text>
                  </View>
                  <Text variant="odds" tabular>
                    {formatOdds(s.odds)}
                  </Text>
                  <Pressable
                    accessibilityLabel={`Remove ${s.selectionLabel}`}
                    onPress={() => {
                      remove(s.selectionId);
                    }}
                    style={{ minHeight: 28, justifyContent: "center" }}
                  >
                    <X size={16} color={t.colors.textMuted} />
                  </Pressable>
                </View>
              ))
            )}

            {selections.length > 0 && (
              <View style={{ paddingVertical: 14, gap: 10 }}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                  }}
                >
                  <Text variant="caption" tone="secondary">
                    {selections.length === 1
                      ? "Single"
                      : `${String(selections.length)}-fold accumulator`}
                  </Text>
                  <Text variant="caption" tabular style={{ fontWeight: "700" }}>
                    Total odds {formatOdds(totals.totalOdds)}
                  </Text>
                </View>
                <View>
                  <Text variant="caps" tone="muted">
                    Stake (simulated ₦)
                  </Text>
                  <View
                    style={{
                      marginTop: 6,
                      flexDirection: "row",
                      alignItems: "center",
                      height: 48,
                      borderRadius: t.radius.sm,
                      borderWidth: 1,
                      borderColor:
                        problem !== undefined && problem !== "EMPTY"
                          ? t.colors.danger
                          : t.colors.border,
                      backgroundColor: t.colors.surfaceSunken,
                      paddingHorizontal: 12,
                    }}
                  >
                    <Text variant="title" tone="muted">
                      ₦
                    </Text>
                    <TextInput
                      value={stakeText}
                      onChangeText={updateStake}
                      keyboardType="decimal-pad"
                      accessibilityLabel="Stake in naira"
                      style={{
                        flex: 1,
                        marginLeft: 6,
                        fontSize: 18,
                        fontWeight: "700",
                        color: t.colors.textPrimary,
                        fontVariant: ["tabular-nums"],
                      }}
                    />
                  </View>
                  <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
                    {QUICK_STAKES.map((q) => (
                      <Pressable
                        key={q}
                        onPress={() => {
                          updateStake((q / 100).toString());
                        }}
                        style={{
                          flex: 1,
                          minHeight: 32,
                          height: 32,
                          borderRadius: t.radius.xs,
                          alignItems: "center",
                          justifyContent: "center",
                          borderWidth: 1,
                          borderColor:
                            stake === q ? t.colors.brand : t.colors.border,
                          backgroundColor:
                            stake === q
                              ? t.colors.brandSubtle
                              : t.colors.surface,
                        }}
                      >
                        <Text
                          variant="caption"
                          tabular
                          tone={stake === q ? "brand" : "secondary"}
                          style={{ fontWeight: "600" }}
                        >
                          {formatMoneyCompact(q)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                {problem === "BELOW_MIN" && (
                  <Text variant="caption" tone="danger">
                    Minimum stake is {formatMoney(STAKE_LIMITS.min)}.
                  </Text>
                )}
                {problem === "ABOVE_MAX" && (
                  <Text variant="caption" tone="danger">
                    Maximum stake is {formatMoney(STAKE_LIMITS.max)}.
                  </Text>
                )}
                {problem === "INSUFFICIENT" && (
                  <Text variant="caption" tone="danger">
                    Exceeds your available balance.
                  </Text>
                )}
                {feedback !== undefined && (
                  <Text variant="caption" tone={feedback.tone}>
                    {feedback.text}
                  </Text>
                )}
                <View style={{ gap: 4 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                    }}
                  >
                    <Text variant="caption" tone="secondary">
                      Potential profit
                    </Text>
                    <Text variant="caption" tabular>
                      {formatMoney(Math.max(0, totals.potentialProfit))}
                    </Text>
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                    }}
                  >
                    <Text variant="bodyStrong">Potential return</Text>
                    <Text variant="bodyStrong" tabular>
                      {formatMoney(totals.potentialReturn)}
                    </Text>
                  </View>
                </View>
                <Button
                  label="Place simulated bet"
                  size="lg"
                  loading={placing}
                  disabled={problem !== undefined}
                  onPress={() => void submit()}
                />
                <Text variant="caption" tone="muted" align="center">
                  Play-money only. No real funds are involved.
                </Text>
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
