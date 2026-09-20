import { View } from "react-native";
import {
  formatBroadcastClock,
  isFinished,
  isInPlay,
  matchClock,
  phaseDescription,
  type MatchSummary,
} from "@betng/ui-core";
import { useNow } from "../hooks/useNow";
import { useTheme } from "../theme";
import { Countdown } from "./Countdown";
import { PhaseBadge } from "./PhaseBadge";
import { TeamBadge } from "./TeamBadge";
import { Text } from "./Text";

export function Scoreboard({
  match,
}: {
  readonly match: MatchSummary;
}): React.JSX.Element {
  const t = useTheme();
  const now = useNow(500);
  const clock = matchClock(match.kickoffAt, now);
  const live = isInPlay(match.phase);
  const done = isFinished(match.phase);

  return (
    <View style={{ alignItems: "center", paddingVertical: 20, gap: 10 }}>
      <PhaseBadge phase={match.phase} solid={live} />
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
        }}
      >
        <View style={{ flex: 1, alignItems: "center", gap: 8 }}>
          <TeamBadge team={match.home} size={52} />
          <Text variant="bodyStrong" align="center" numberOfLines={2}>
            {match.home.name}
          </Text>
        </View>
        <View style={{ alignItems: "center", minWidth: 120 }}>
          {live || done ? (
            <Text variant="score" tabular tone={done ? "secondary" : "primary"}>
              {match.score.home}
              <Text variant="score" tone="muted" style={{ fontWeight: "400" }}>
                {" "}
                –{" "}
              </Text>
              {match.score.away}
            </Text>
          ) : (
            <Countdown
              to={match.kickoffAt}
              variant="display"
              tone="secondary"
            />
          )}
          <Text
            variant="caption"
            tone={live ? "live" : "muted"}
            tabular
            style={{ marginTop: 6, fontWeight: "600" }}
          >
            {live
              ? match.phase === "HALFTIME"
                ? "Half time"
                : formatBroadcastClock(clock.minute, clock.second)
              : done
                ? phaseDescription(match.phase)
                : "Kick-off"}
          </Text>
        </View>
        <View style={{ flex: 1, alignItems: "center", gap: 8 }}>
          <TeamBadge team={match.away} size={52} />
          <Text variant="bodyStrong" align="center" numberOfLines={2}>
            {match.away.name}
          </Text>
        </View>
      </View>
      <Text variant="caption" tone="muted">
        {match.leagueName} · Matchday {String(match.matchday).padStart(2, "0")}{" "}
        · {match.home.stadium}
      </Text>
      <View
        style={{
          height: 1,
          width: "100%",
          backgroundColor: t.colors.border,
          marginTop: 6,
        }}
      />
    </View>
  );
}
