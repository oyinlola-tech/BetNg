import {
  Text as RNText,
  type TextProps as RNTextProps,
  type TextStyle,
} from "react-native";
import { useTheme } from "../theme";

export type Variant =
  | "caps"
  | "caption"
  | "body"
  | "bodyStrong"
  | "title"
  | "heading"
  | "display"
  | "score"
  | "odds";

export interface TextProps extends RNTextProps {
  readonly variant?: Variant;
  readonly tone?:
    | "primary"
    | "secondary"
    | "muted"
    | "brand"
    | "live"
    | "success"
    | "danger"
    | "onBrand"
    | "warning";
  readonly tabular?: boolean;
  readonly align?: TextStyle["textAlign"];
}

export function Text({
  variant = "body",
  tone = "primary",
  tabular = false,
  align,
  style,
  ...rest
}: TextProps): React.JSX.Element {
  const t = useTheme();
  const color = {
    primary: t.colors.textPrimary,
    secondary: t.colors.textSecondary,
    muted: t.colors.textMuted,
    brand: t.colors.brand,
    live: t.colors.live,
    success: t.colors.success,
    danger: t.colors.danger,
    warning: t.colors.warning,
    onBrand: t.colors.textOnBrand,
  }[tone];

  const variants: Record<Variant, TextStyle> = {
    caps: {
      fontSize: t.text.xs,
      fontWeight: "600",
      letterSpacing: 0.8,
      textTransform: "uppercase",
    },
    caption: { fontSize: t.text.sm, fontWeight: "400" },
    body: { fontSize: t.text.md, fontWeight: "400" },
    bodyStrong: { fontSize: t.text.md, fontWeight: "600" },
    title: { fontSize: t.text.lg, fontWeight: "700", letterSpacing: -0.2 },
    heading: {
      fontSize: t.text["2xl"],
      fontWeight: "800",
      letterSpacing: -0.5,
    },
    display: {
      fontSize: t.text["3xl"],
      fontWeight: "800",
      letterSpacing: -0.8,
    },
    score: {
      fontSize: t.text["5xl"],
      fontWeight: "800",
      letterSpacing: -1.5,
      lineHeight: t.text["5xl"],
    },
    odds: { fontSize: t.text.md, fontWeight: "700" },
  };

  return (
    <RNText
      {...rest}
      style={[
        { color, ...variants[variant] },
        tabular && { fontVariant: ["tabular-nums"] },
        align !== undefined && { textAlign: align },
        style,
      ]}
    />
  );
}
