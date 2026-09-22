import { Modal, ScrollView, View } from "react-native";
import { Card, Pressable, Text } from "../../components";
import { useTheme } from "../../theme";

export function SheetFrame({
  visible,
  title,
  onClose,
  children,
}: {
  readonly visible: boolean;
  readonly title: string;
  readonly onClose: () => void;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const t = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: t.colors.overlay, justifyContent: "center", padding: 24 }}>
        <Card style={{ padding: 16, backgroundColor: t.colors.surfaceElevated, maxHeight: "90%" }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12 }}>
            <Text variant="title">{title}</Text>
            {children}
          </ScrollView>
        </Card>
      </View>
    </Modal>
  );
}

export function Choice({
  label,
  selected,
  onPress,
}: {
  readonly label: string;
  readonly selected: boolean;
  readonly onPress: () => void;
}): React.JSX.Element {
  const t = useTheme();

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        flex: 1,
        minHeight: 44,
        paddingHorizontal: 8,
        borderRadius: t.radius.sm,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? t.colors.brand : t.colors.border,
        backgroundColor: selected ? t.colors.brandSubtle : t.colors.surface,
      }}
    >
      <Text variant="caption" tone={selected ? "brand" : "secondary"} align="center" style={{ fontWeight: "600" }}>
        {label}
      </Text>
    </Pressable>
  );
}
