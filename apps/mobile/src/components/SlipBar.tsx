import { View } from "react-native";
import { Receipt } from "lucide-react-native";
import { combinedOdds, formatOdds } from "@betng/ui-core";
import { useBetSlip } from "../stores/betslip.store";
import { useTheme } from "../theme";
import { Pressable } from "./Pressable";
import { Text } from "./Text";

/* Sits just above the tab bar whenever the slip has selections, so the slip is one tap away from any screen. */
export function SlipBar({
  bottom,
}: {
  readonly bottom: number;
}): React.JSX.Element | null {
  const t = useTheme();
  const selections = useBetSlip((s) => s.selections);
  const setOpen = useBetSlip((s) => s.setOpen);

  if (selections.length === 0) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{ position: "absolute", left: 16, right: 16, bottom: bottom + 8 }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open bet slip, ${String(selections.length)} selections`}
        onPress={() => {
          setOpen(true);
        }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          height: 52,
          borderRadius: t.radius.md,
          backgroundColor: t.colors.brand,
          paddingHorizontal: 16,
          shadowColor: "#000",
          shadowOpacity: 0.25,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
        }}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: "rgba(255,255,255,0.2)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            variant="caption"
            tone="onBrand"
            tabular
            style={{ fontWeight: "800" }}
          >
            {selections.length}
          </Text>
        </View>
        <Text variant="bodyStrong" tone="onBrand" style={{ flex: 1 }}>
          Bet slip
        </Text>
        <Text variant="caption" tone="onBrand" tabular>
          @ {formatOdds(combinedOdds(selections))}
        </Text>
        <Receipt size={18} color={t.colors.textOnBrand} />
      </Pressable>
    </View>
  );
}
