import { View } from "react-native";
import { phaseLabel, phaseTone, type MatchPhase } from "@betng/ui-core";
import { useTheme } from "../theme";
import { Text } from "./Text";

export function PhaseBadge({
  phase,
  minute,
  solid = false,
}: {
  readonly phase: MatchPhase;
  readonly minute?: number;
  readonly solid?: boolean;
}): React.JSX.Element {
  const t = useTheme();
  const tone = phaseTone(phase);
  const palette = {
    live: [t.colors.live, t.colors.liveSubtle],
    brand: [t.colors.brand, t.colors.brandSubtle],
    warning: [t.colors.warning, t.colors.warningSubtle],
    success: [t.colors.success, t.colors.successSubtle],
    neutral: [t.colors.textSecondary, t.colors.surfaceSunken],
    muted: [t.colors.textMuted, t.colors.surfaceSunken],
  }[tone] as [string, string];
  const [fg, bg] = palette;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: solid ? fg : bg,
        paddingHorizontal: 6,
        height: 20,
        borderRadius: t.radius.xs,
        alignSelf: "flex-start",
      }}
    >
      {phase === "LIVE" && (
        <View
          style={{
            width: 5,
            height: 5,
            borderRadius: 3,
            backgroundColor: solid ? "#fff" : fg,
          }}
        />
      )}
      <Text variant="caps" style={{ color: solid ? "#fff" : fg, fontSize: 10 }}>
        {phaseLabel(phase)}
        {phase === "LIVE" && minute !== undefined ? ` ${String(minute)}'` : ""}
      </Text>
    </View>
  );
}
