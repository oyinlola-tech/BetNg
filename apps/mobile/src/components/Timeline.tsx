import { View } from "react-native";
import { ArrowLeftRight, Flag, Goal, Square } from "lucide-react-native";
import type {
  MatchEventKind,
  MatchEventView,
  MatchSummary,
} from "@betng/ui-core";
import { useTheme } from "../theme";
import { EmptyState } from "./States";
import { Text } from "./Text";

const KEY: ReadonlySet<MatchEventKind> = new Set([
  "GOAL",
  "YELLOW_CARD",
  "RED_CARD",
  "SUBSTITUTION",
  "HALF_TIME",
  "FULL_TIME",
  "KICK_OFF",
]);

export function Timeline({
  match,
  events,
  keyOnly = false,
  limit,
}: {
  readonly match: MatchSummary;
  readonly events: readonly MatchEventView[];
  readonly keyOnly?: boolean;
  readonly limit?: number;
}): React.JSX.Element {
  const t = useTheme();
  let list = [
    ...(keyOnly ? events.filter((e) => KEY.has(e.kind)) : events),
  ].reverse();

  if (limit !== undefined) list = list.slice(0, limit);

  if (list.length === 0)
    return (
      <EmptyState
        title="No events yet"
        description="Events appear here as the match unfolds."
      />
    );

  const icon = (kind: MatchEventKind): React.ReactNode => {
    switch (kind) {
      case "GOAL":
        return <Goal size={16} color={t.colors.textPrimary} />;
      case "YELLOW_CARD":
        return (
          <Square size={13} color={t.colors.warning} fill={t.colors.warning} />
        );
      case "RED_CARD":
        return (
          <Square size={13} color={t.colors.danger} fill={t.colors.danger} />
        );
      case "SUBSTITUTION":
        return <ArrowLeftRight size={15} color={t.colors.textMuted} />;
      case "CORNER":
        return <Flag size={13} color={t.colors.textMuted} />;
      default:
        return (
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: t.colors.textMuted,
            }}
          />
        );
    }
  };

  return (
    <View>
      {list.map((e, i) => {
        const structural = e.side === undefined;

        return (
          <View
            key={e.id}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              paddingVertical: 10,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: t.colors.border,
              backgroundColor:
                e.kind === "GOAL" ? t.colors.surfaceSunken : "transparent",
              marginHorizontal: e.kind === "GOAL" ? -12 : 0,
              paddingHorizontal: e.kind === "GOAL" ? 12 : 0,
              borderRadius: t.radius.sm,
            }}
          >
            <Text
              variant="caption"
              tone="muted"
              tabular
              style={{ width: 32, fontWeight: "600" }}
            >
              {structural ? "" : `${String(e.minute)}'`}
            </Text>
            <View style={{ width: 20, alignItems: "center" }}>
              {icon(e.kind)}
            </View>
            <View style={{ flex: 1 }}>
              {structural ? (
                <Text variant="caps" tone="muted">
                  {e.description}
                </Text>
              ) : (
                <>
                  <Text
                    variant={e.kind === "GOAL" ? "bodyStrong" : "body"}
                    tone={e.kind === "GOAL" ? "primary" : "secondary"}
                    numberOfLines={1}
                  >
                    {e.player ?? e.description}
                  </Text>
                  {e.player !== undefined && (
                    <Text variant="caption" tone="muted" numberOfLines={1}>
                      {e.kind === "GOAL" && e.secondaryPlayer !== undefined
                        ? `Assist · ${e.secondaryPlayer}`
                        : e.kind === "SUBSTITUTION"
                          ? `Off · ${e.secondaryPlayer ?? ""}`
                          : e.kind === "YELLOW_CARD"
                            ? "Yellow card"
                            : e.kind === "RED_CARD"
                              ? "Red card"
                              : ""}
                    </Text>
                  )}
                </>
              )}
            </View>
            <Text
              variant="caption"
              tone="muted"
              tabular
              style={{ fontWeight: "600" }}
            >
              {structural
                ? `${String(e.score.home)}–${String(e.score.away)}`
                : e.side === "HOME"
                  ? match.home.code
                  : match.away.code}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
