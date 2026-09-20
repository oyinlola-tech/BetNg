import { View } from "react-native";
import { ArrowDown, ArrowUp } from "lucide-react-native";
import { formatOdds, type SelectionView } from "@betng/ui-core";
import { useTheme } from "../theme";
import { Pressable } from "./Pressable";
import { Text } from "./Text";

export function OddsButton({
  selection,
  selected,
  disabled = false,
  onPress,
  compact = false,
}: {
  readonly selection: SelectionView;
  readonly selected: boolean;
  readonly disabled?: boolean;
  readonly onPress: () => void;
  readonly compact?: boolean;
}): React.JSX.Element {
  const t = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={`${selection.label}, odds ${formatOdds(selection.odds)}`}
      disabled={disabled}
      onPress={onPress}
      style={{
        flex: 1,
        minHeight: 44,
        height: compact ? 44 : 48,
        borderRadius: t.radius.sm,
        backgroundColor: selected ? t.colors.brand : t.colors.surfaceSunken,
        borderWidth: 1,
        borderColor: selected ? t.colors.brand : "transparent",
        paddingHorizontal: 10,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <Text
        variant="caption"
        numberOfLines={1}
        style={{
          color: selected ? t.colors.textOnBrand : t.colors.textSecondary,
          flexShrink: 1,
        }}
      >
        {compact ? selection.shortLabel : selection.label}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
        {selection.trend === "UP" && (
          <ArrowUp
            size={11}
            color={selected ? t.colors.textOnBrand : t.colors.success}
          />
        )}
        {selection.trend === "DOWN" && (
          <ArrowDown
            size={11}
            color={selected ? t.colors.textOnBrand : t.colors.danger}
          />
        )}
        <Text
          variant="odds"
          tabular
          style={{
            color: selected ? t.colors.textOnBrand : t.colors.textPrimary,
          }}
        >
          {formatOdds(selection.odds)}
        </Text>
      </View>
    </Pressable>
  );
}
