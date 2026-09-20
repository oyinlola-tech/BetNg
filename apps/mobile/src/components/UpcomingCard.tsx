import { View } from "react-native";
import type { MatchSummary } from "@betng/ui-core";
import { Card } from "./Card";
import { Countdown } from "./Countdown";
import { PhaseBadge } from "./PhaseBadge";
import { Pressable } from "./Pressable";
import { TeamBadge } from "./TeamBadge";
import { Text } from "./Text";

export function UpcomingCard({
  match,
  onPress,
  width,
}: {
  readonly match: MatchSummary;
  readonly onPress: () => void;
  readonly width?: number;
}): React.JSX.Element {
  return (
    <Card style={{ width }}>
      <Pressable
        accessibilityRole="button"
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
          <PhaseBadge phase={match.phase} />
          <Text variant="caption" tone="muted">
            {match.leagueCode} · MD {String(match.matchday).padStart(2, "0")}
          </Text>
        </View>
        <View
          style={{
            marginTop: 14,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <View style={{ flex: 1, alignItems: "center", gap: 6 }}>
            <TeamBadge team={match.home} size={36} />
            <Text
              variant="caption"
              style={{ fontWeight: "600" }}
              numberOfLines={1}
            >
              {match.home.shortName}
            </Text>
          </View>
          <View style={{ alignItems: "center" }}>
            <Countdown to={match.kickoffAt} variant="title" />
            <Text variant="caps" tone="muted" style={{ fontSize: 9 }}>
              kick-off
            </Text>
          </View>
          <View style={{ flex: 1, alignItems: "center", gap: 6 }}>
            <TeamBadge team={match.away} size={36} />
            <Text
              variant="caption"
              style={{ fontWeight: "600" }}
              numberOfLines={1}
            >
              {match.away.shortName}
            </Text>
          </View>
        </View>
      </Pressable>
    </Card>
  );
}
