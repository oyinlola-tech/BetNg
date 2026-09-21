import { View } from "react-native";
import { Play } from "lucide-react-native";
import {
  formatBroadcastClock,
  clockProgress,
  displayClock,
  type MatchSummary,
} from "@betng/ui-core";
import { useNow } from "../hooks/useNow";
import { useTheme } from "../theme";
import { Card } from "./Card";
import { PhaseBadge } from "./PhaseBadge";
import { Pressable } from "./Pressable";
import { TeamBadge } from "./TeamBadge";
import { Text } from "./Text";

export function LiveMatchCard({
  match,
  onPress,
  width,
}: {
  readonly match: MatchSummary;
  readonly onPress: () => void;
  readonly width?: number;
}): React.JSX.Element {
  const t = useTheme();
  const now = useNow(500);
  const clock = displayClock(match.clock, now);
  const progress = clockProgress(clock) * 100;

  return (
    <Card style={{ width }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Watch ${match.home.name} versus ${match.away.name}`}
        onPress={onPress}
        style={{ padding: 14 }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <PhaseBadge phase={match.phase} solid />
            <Text variant="caption" tone="muted">
              {match.leagueCode} · MD {String(match.matchday).padStart(2, "0")}
            </Text>
          </View>
          <Text
            variant="caption"
            tone="live"
            tabular
            style={{ fontWeight: "700" }}
          >
            {match.phase === "HALFTIME"
              ? "HT"
              : clock === undefined
                ? "LIVE"
                : formatBroadcastClock(clock.minute, clock.second)}
          </Text>
        </View>
        <View style={{ marginTop: 12, gap: 10 }}>
          {(["home", "away"] as const).map((side) => (
            <View
              key={side}
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <TeamBadge team={match[side]} size={28} />
              <Text variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
                {match[side].name}
              </Text>
              <Text variant="heading" tabular>
                {match.score[side]}
              </Text>
            </View>
          ))}
        </View>
        <View
          style={{
            marginTop: 14,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View
            style={{
              flex: 1,
              height: 3,
              backgroundColor: t.colors.surfaceSunken,
              borderRadius: 2,
              marginRight: 12,
            }}
          >
            <View
              style={{
                width: `${progress}%`,
                height: 3,
                backgroundColor: t.colors.live,
                borderRadius: 2,
              }}
            />
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              backgroundColor: t.colors.surfaceSunken,
              paddingHorizontal: 12,
              height: 32,
              borderRadius: t.radius.sm,
            }}
          >
            <Play size={12} color={t.colors.textPrimary} />
            <Text variant="caption" style={{ fontWeight: "700" }}>
              Watch
            </Text>
          </View>
        </View>
      </Pressable>
    </Card>
  );
}
