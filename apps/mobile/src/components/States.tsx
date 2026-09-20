import { StyleSheet, View } from "react-native";
import { Inbox, RefreshCw, WifiOff } from "lucide-react-native";
import { useTheme } from "../theme";
import { presentError } from "../lib/errors";
import { Button } from "./Button";
import { Text } from "./Text";

export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  readonly title: string;
  readonly description?: string | undefined;
  readonly icon?: React.ReactNode;
  readonly action?: React.ReactNode;
}): React.JSX.Element {
  const t = useTheme();

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.icon,
          {
            backgroundColor: t.colors.surfaceSunken,
            borderRadius: t.radius.md,
          },
        ]}
      >
        {icon ?? <Inbox size={20} color={t.colors.textMuted} />}
      </View>
      <Text variant="bodyStrong" align="center" style={{ marginTop: 12 }}>
        {title}
      </Text>
      {description !== undefined && (
        <Text
          variant="caption"
          tone="muted"
          align="center"
          style={{ marginTop: 4, maxWidth: 260 }}
        >
          {description}
        </Text>
      )}
      {action !== undefined && <View style={{ marginTop: 16 }}>{action}</View>}
    </View>
  );
}

export function ErrorState({
  error,
  onRetry,
}: {
  readonly error: unknown;
  readonly onRetry?: () => void;
}): React.JSX.Element {
  const t = useTheme();
  const p = presentError(error);

  return (
    <View style={styles.wrap} accessibilityRole="alert">
      <View
        style={[
          styles.icon,
          { backgroundColor: t.colors.dangerSubtle, borderRadius: t.radius.md },
        ]}
      >
        {p.title === "Connection problem" ? (
          <WifiOff size={20} color={t.colors.danger} />
        ) : (
          <RefreshCw size={20} color={t.colors.danger} />
        )}
      </View>
      <Text variant="bodyStrong" align="center" style={{ marginTop: 12 }}>
        {p.title}
      </Text>
      <Text
        variant="caption"
        tone="muted"
        align="center"
        style={{ marginTop: 4, maxWidth: 260 }}
      >
        {p.message}
      </Text>
      {onRetry !== undefined && p.retryable && (
        <Button
          label="Try again"
          variant="secondary"
          size="sm"
          onPress={onRetry}
          style={{ marginTop: 16 }}
        />
      )}
    </View>
  );
}

export function Skeleton({
  height = 16,
  width,
  radius = 4,
  style,
}: {
  readonly height?: number;
  readonly width?: number | `${number}%`;
  readonly radius?: number;
  readonly style?: object;
}): React.JSX.Element {
  const t = useTheme();

  return (
    <View
      accessibilityElementsHidden
      style={[
        {
          height,
          width: width ?? "100%",
          borderRadius: radius,
          backgroundColor: t.colors.skeleton,
        },
        style,
      ]}
    />
  );
}

export function SkeletonRows({
  rows = 4,
}: {
  readonly rows?: number;
}): React.JSX.Element {
  return (
    <View style={{ gap: 12 }} accessibilityLabel="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <View
          key={i}
          style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
        >
          <Skeleton height={28} width={28} radius={14} />
          <Skeleton height={14} width="60%" />
          <View style={{ flex: 1 }} />
          <Skeleton height={14} width={40} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  icon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
});
