import { View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import {
  formatKickoffTime,
  isFinished,
  isInPlay,
  displayClock,
  type MatchSummary,
} from "@betng/ui-core";
import { useNow } from "../hooks/useNow";
import { useTheme } from "../theme";
import { Countdown } from "./Countdown";
import { PhaseBadge } from "./PhaseBadge";
import { Pressable } from "./Pressable";
import { TeamBadge } from "./TeamBadge";
import { Text } from "./Text";

export function MatchRow({
  match,
  onPress,
  showLeague = false,
}: {
  readonly match: MatchSummary;
  readonly onPress: () => void;
  readonly showLeague?: boolean;
}): React.JSX.Element {
  const t = useTheme();
  const now = useNow(1000);
  const live = isInPlay(match.phase);
  const done = isFinished(match.phase);
  const minute = displayClock(match.clock, now)?.minute;
  const winner = done
    ? match.score.home > match.score.away
      ? "HOME"
      : match.score.away > match.score.home
        ? "AWAY"
        : undefined
    : undefined;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
      }}
    >
      <View style={{ width: 64, gap: 3 }}>
        <PhaseBadge phase={match.phase} minute={minute} />
        <Text variant="caption" tone="muted" tabular>
          {showLeague
            ? match.leagueCode
            : live
              ? ""
              : done
                ? formatKickoffTime(match.kickoffAt)
                : ""}
        </Text>
        {!live && !done && !showLeague && (
          <Countdown to={match.kickoffAt} variant="caption" tone="muted" />
        )}
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        {(["home", "away"] as const).map((side) => (
          <View
            key={side}
            style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
          >
            <TeamBadge team={match[side]} size={20} />
            <Text
              variant={winner === side.toUpperCase() ? "bodyStrong" : "body"}
              tone={
                winner === undefined || winner === side.toUpperCase()
                  ? "primary"
                  : "secondary"
              }
              numberOfLines={1}
              style={{ flex: 1 }}
            >
              {match[side].name}
            </Text>
            {(live || done) && (
              <Text
                variant="bodyStrong"
                tabular
                tone={
                  winner === undefined || winner === side.toUpperCase()
                    ? "primary"
                    : "secondary"
                }
              >
                {match.score[side]}
              </Text>
            )}
          </View>
        ))}
      </View>
      <ChevronRight size={16} color={t.colors.textMuted} />
    </Pressable>
  );
}
