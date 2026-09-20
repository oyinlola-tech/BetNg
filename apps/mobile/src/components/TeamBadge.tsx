import { View } from "react-native";
import type { TeamView } from "@betng/ui-core";
import { Text } from "./Text";

export function TeamBadge({
  team,
  size = 28,
}: {
  readonly team: Pick<TeamView, "code" | "colors" | "name">;
  readonly size?: number;
}): React.JSX.Element {
  return (
    <View
      accessibilityLabel={team.name}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: team.colors.primary,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
        borderColor: `${team.colors.secondary}55`,
      }}
    >
      <Text
        style={{
          color: team.colors.onPrimary,
          fontSize: size * 0.32,
          fontWeight: "800",
          letterSpacing: 0.5,
        }}
      >
        {team.code}
      </Text>
    </View>
  );
}
