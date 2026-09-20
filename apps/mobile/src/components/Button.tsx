import {
  ActivityIndicator,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useTheme } from "../theme";
import { Pressable } from "./Pressable";
import { Text } from "./Text";

export interface ButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: "primary" | "secondary" | "ghost" | "live";
  readonly size?: "sm" | "md" | "lg";
  readonly loading?: boolean;
  readonly disabled?: boolean;
  readonly icon?: React.ReactNode;
  readonly style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  icon,
  style,
}: ButtonProps): React.JSX.Element {
  const t = useTheme();
  const background = {
    primary: t.colors.brand,
    secondary: t.colors.surface,
    ghost: "transparent",
    live: t.colors.live,
  }[variant];
  const color =
    variant === "primary" || variant === "live"
      ? t.colors.textOnBrand
      : t.colors.textPrimary;
  const height = { sm: 36, md: 44, lg: 52 }[size];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={[
        styles.base,
        {
          height,
          minHeight: height,
          backgroundColor: background,
          borderRadius: t.radius.sm,
          opacity: disabled ? 0.5 : 1,
        },
        variant === "secondary" && {
          borderWidth: 1,
          borderColor: t.colors.borderStrong,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={color} />
      ) : icon !== undefined ? (
        <View>{icon}</View>
      ) : null}
      <Text variant="bodyStrong" style={{ color }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
  },
});
