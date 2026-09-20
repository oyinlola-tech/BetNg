import { View } from "react-native";
import { WifiOff } from "lucide-react-native";
import { useConnection } from "../hooks/useConnection";
import { useTheme } from "../theme";
import { Text } from "./Text";

export function ConnectionBanner(): React.JSX.Element | null {
  const state = useConnection();
  const t = useTheme();

  if (state === "CONNECTED" || state === "CONNECTING") return null;

  return (
    <View
      accessibilityRole="alert"
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        backgroundColor: t.colors.warningSubtle,
        paddingVertical: 6,
        paddingHorizontal: 16,
      }}
    >
      <WifiOff size={14} color={t.colors.warning} />
      <Text variant="caption" tone="warning" style={{ fontWeight: "600" }}>
        {state === "OFFLINE"
          ? "Offline — showing the last known state"
          : "Reconnecting…"}
      </Text>
    </View>
  );
}
