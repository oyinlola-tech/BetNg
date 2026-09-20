import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type ViewProps,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme";

export interface ScreenProps extends ViewProps {
  readonly scroll?: boolean;
  readonly padded?: boolean;
  readonly refreshing?: boolean;
  readonly onRefresh?: () => void;
  readonly bottomInset?: boolean;
}

export function Screen({
  scroll = true,
  padded = true,
  refreshing = false,
  onRefresh,
  bottomInset = true,
  style,
  children,
  ...rest
}: ScreenProps): React.JSX.Element {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const padding = padded ? t.space[4] : 0;

  if (!scroll) {
    return (
      <View
        {...rest}
        style={[
          styles.fill,
          { backgroundColor: t.colors.background, paddingHorizontal: padding },
          style,
        ]}
      >
        {children}
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.fill, { backgroundColor: t.colors.background }]}
      contentContainerStyle={[
        {
          paddingHorizontal: padding,
          paddingTop: t.space[3],
          paddingBottom: (bottomInset ? insets.bottom : 0) + t.space[24],
        },
        style,
      ]}
      refreshControl={
        onRefresh === undefined ? undefined : (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={t.colors.textMuted}
          />
        )
      }
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
