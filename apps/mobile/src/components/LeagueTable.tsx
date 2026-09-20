import { View } from "react-native";
import type { FormResult, StandingsView } from "@betng/ui-core";
import { useTheme } from "../theme";
import { Pressable } from "./Pressable";
import { TeamBadge } from "./TeamBadge";
import { Text } from "./Text";

export function FormPips({
  form,
}: {
  readonly form: readonly FormResult[];
}): React.JSX.Element {
  const t = useTheme();

  return (
    <View
      style={{ flexDirection: "row", gap: 2 }}
      accessibilityLabel={`Form ${form.join(" ")}`}
    >
      {form.map((r, i) => (
        <View
          key={i}
          style={{
            width: 16,
            height: 16,
            borderRadius: 3,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor:
              r === "W"
                ? t.colors.success
                : r === "L"
                  ? t.colors.danger
                  : t.colors.borderStrong,
          }}
        >
          <Text
            style={{
              fontSize: 9,
              fontWeight: "800",
              color: r === "D" ? t.colors.textPrimary : "#fff",
            }}
          >
            {r}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function LeagueTable({
  standings,
  onTeam,
  highlight = [],
}: {
  readonly standings: StandingsView;
  readonly onTeam?: (teamId: string) => void;
  readonly highlight?: readonly string[];
}): React.JSX.Element {
  const t = useTheme();
  const total = standings.rows.length;
  const col = (w: number, label: string): React.JSX.Element => (
    <Text
      key={label}
      variant="caps"
      tone="muted"
      style={{ width: w, textAlign: "right", fontSize: 10 }}
    >
      {label}
    </Text>
  );

  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderBottomWidth: 1,
          borderBottomColor: t.colors.border,
        }}
      >
        <Text variant="caps" tone="muted" style={{ width: 28, fontSize: 10 }}>
          #
        </Text>
        <Text variant="caps" tone="muted" style={{ flex: 1, fontSize: 10 }}>
          Team
        </Text>
        {col(28, "P")}
        {col(34, "GD")}
        {col(36, "Pts")}
      </View>
      {standings.rows.map((row) => {
        const top = row.position <= 2;
        const bottom = row.position > total - 2;
        const hl = highlight.includes(row.team.id);

        return (
          <Pressable
            key={row.team.id}
            onPress={
              onTeam === undefined
                ? undefined
                : () => {
                    onTeam(row.team.id);
                  }
            }
            accessibilityRole={onTeam === undefined ? undefined : "button"}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderBottomWidth: 1,
              borderBottomColor: t.colors.border,
              backgroundColor: hl ? t.colors.brandSubtle : "transparent",
            }}
          >
            <View style={{ width: 28 }}>
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 4,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: top
                    ? t.colors.brandSubtle
                    : bottom
                      ? t.colors.dangerSubtle
                      : "transparent",
                }}
              >
                <Text
                  variant="caption"
                  tabular
                  tone={top ? "brand" : bottom ? "danger" : "muted"}
                  style={{ fontWeight: "700" }}
                >
                  {row.position}
                </Text>
              </View>
            </View>
            <View
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <TeamBadge team={row.team} size={20} />
              <Text
                variant="body"
                numberOfLines={1}
                style={{ flex: 1, fontWeight: "500" }}
              >
                {row.team.shortName}
              </Text>
            </View>
            <Text
              variant="caption"
              tone="secondary"
              tabular
              style={{ width: 28, textAlign: "right" }}
            >
              {row.played}
            </Text>
            <Text
              variant="caption"
              tone="secondary"
              tabular
              style={{ width: 34, textAlign: "right" }}
            >
              {row.goalDifference > 0
                ? `+${String(row.goalDifference)}`
                : row.goalDifference}
            </Text>
            <Text
              variant="bodyStrong"
              tabular
              style={{ width: 36, textAlign: "right" }}
            >
              {row.points}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
