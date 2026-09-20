import { ScrollView } from "react-native";
import { useTheme } from "../theme";
import { Pressable } from "./Pressable";
import { Text } from "./Text";

export interface TabItem<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly count?: number;
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  segmented = false,
}: {
  readonly items: readonly TabItem<T>[];
  readonly value: T;
  readonly onChange: (v: T) => void;
  readonly segmented?: boolean;
}): React.JSX.Element {
  const t = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        gap: segmented ? 2 : 4,
        padding: segmented ? 2 : 0,
        backgroundColor: segmented ? t.colors.surfaceSunken : "transparent",
        borderRadius: t.radius.sm,
        minWidth: "100%",
      }}
    >
      {items.map((item) => {
        const active = item.value === value;

        return (
          <Pressable
            key={item.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => {
              onChange(item.value);
            }}
            style={[
              {
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 14,
                minHeight: 36,
                height: 36,
                borderRadius: t.radius.xs,
                flexGrow: segmented ? 1 : 0,
                justifyContent: "center",
              },
              active &&
                (segmented
                  ? { backgroundColor: t.colors.surface }
                  : { backgroundColor: t.colors.surfaceSunken }),
            ]}
          >
            <Text
              variant="bodyStrong"
              tone={active ? "primary" : "muted"}
              style={{ fontSize: t.text.base }}
            >
              {item.label}
            </Text>
            {item.count !== undefined && (
              <Text variant="caption" tone={active ? "brand" : "muted"} tabular>
                {item.count}
              </Text>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
