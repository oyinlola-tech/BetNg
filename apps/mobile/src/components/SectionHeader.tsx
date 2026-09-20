import { View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { useTheme } from "../theme";
import { Pressable } from "./Pressable";
import { Text } from "./Text";

export function SectionHeader({
  title,
  eyebrow,
  onPress,
  linkLabel = "See all",
}: {
  readonly title: string;
  readonly eyebrow?: string;
  readonly onPress?: () => void;
  readonly linkLabel?: string;
}): React.JSX.Element {
  const t = useTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "space-between",
        marginBottom: 10,
        marginTop: 20,
      }}
    >
      <View>
        {eyebrow !== undefined && (
          <Text variant="caps" tone="muted">
            {eyebrow}
          </Text>
        )}
        <Text variant="title">{title}</Text>
      </View>
      {onPress !== undefined && (
        <Pressable
          onPress={onPress}
          accessibilityRole="link"
          style={{ flexDirection: "row", alignItems: "center", minHeight: 32 }}
        >
          <Text variant="caption" tone="secondary">
            {linkLabel}
          </Text>
          <ChevronRight size={16} color={t.colors.textMuted} />
        </Pressable>
      )}
    </View>
  );
}
