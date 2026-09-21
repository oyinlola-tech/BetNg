import { View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { LOGO_B_PATH, LOGO_CUT_PATH, LOGO_TILE_PATH, LOGO_VIEWBOX } from "@betng/brand";
import { useTheme } from "../theme";
import { Text } from "./Text";

export function BrandLogo({ size = 28, wordmark = true }: { readonly size?: number; readonly wordmark?: boolean }): React.JSX.Element {
  const t = useTheme();

  return (
    <View accessible accessibilityRole="image" accessibilityLabel="BETNG" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Svg width={size} height={size} viewBox={LOGO_VIEWBOX}>
        <Path d={LOGO_TILE_PATH} fill={t.colors.brand} />
        <Path d={LOGO_B_PATH} fill={t.colors.textOnBrand} />
        <Path d={LOGO_CUT_PATH} fill={t.colors.brand} opacity={0.92} />
      </Svg>
      {wordmark && (
        <Text style={{ fontSize: size * 0.68, fontWeight: "800", letterSpacing: -0.6, color: t.colors.textPrimary }}>
          BET<Text style={{ fontSize: size * 0.68, fontWeight: "800", letterSpacing: -0.6, color: t.colors.brand }}>NG</Text>
        </Text>
      )}
    </View>
  );
}
