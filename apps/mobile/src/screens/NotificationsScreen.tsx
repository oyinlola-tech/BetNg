import { useLayoutEffect } from "react";
import { View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Bell, Gauge, Goal, IdCard, Receipt, ShieldAlert, Timer, Trophy, Wallet } from "lucide-react-native";
import { formatRelative, type NotificationKind } from "@betng/ui-core";
import {
  Card,
  EmptyState,
  ErrorState,
  Pressable,
  Screen,
  SkeletonRows,
  Text,
} from "../components";
import { useAccountVersion } from "../hooks/useAccount";
import { useAsync } from "../hooks/useAsync";
import { navigationRef } from "../navigation/ref";
import { openTarget } from "../platform/linking";
import { notificationTarget } from "../platform/notificationRoutes";
import { getDataSource } from "../services/dataSource";
import { useTheme } from "../theme";

const ICONS: Record<NotificationKind, typeof Bell> = {
  MATCH_STARTING: Timer,
  MATCH_FINISHED: Trophy,
  RESULT_AVAILABLE: Trophy,
  BET_SETTLED: Receipt,
  MATCH_EVENT: Goal,
  BET_ACCEPTED: Receipt,
  PAYMENT_UPDATED: Wallet,
  KYC_UPDATED: IdCard,
  SECURITY_ALERT: ShieldAlert,
  LIMIT_WARNING: Gauge,
};

export function NotificationsScreen(): React.JSX.Element {
  const t = useTheme();
  const navigation = useNavigation();
  const version = useAccountVersion();
  const notifications = useAsync(
    () => getDataSource().listNotifications(),
    [version],
    10_000,
  );
  const unread = notifications.data?.filter((n) => !n.read).length ?? 0;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        unread > 0 ? (
          <Pressable
            onPress={() =>
              void getDataSource()
                .markNotificationsRead()
                .then(() => notifications.refresh())
            }
            style={{ justifyContent: "center", paddingHorizontal: 8 }}
          >
            <Text variant="caption" tone="brand" style={{ fontWeight: "700" }}>
              Mark all read
            </Text>
          </Pressable>
        ) : null,
    });
  }, [navigation, unread, notifications]);

  return (
    <Screen
      refreshing={notifications.refreshing}
      onRefresh={() => void notifications.refresh()}
    >
      <Card>
        {notifications.error !== undefined ? (
          <ErrorState
            error={notifications.error}
            onRetry={() => void notifications.refresh()}
          />
        ) : notifications.data === undefined ? (
          <View style={{ padding: 12 }}>
            <SkeletonRows rows={6} />
          </View>
        ) : notifications.data.length === 0 ? (
          <EmptyState
            icon={<Bell size={20} color={t.colors.textMuted} />}
            title="No notifications"
            description="Kick-offs, results and settled bets for matches you follow will show up here."
          />
        ) : (
          notifications.data.map((n, i) => {
            const Icon = ICONS[n.kind];

            return (
              <Pressable
                key={n.id}
                accessibilityRole="button"
                onPress={() => {
                  if (!n.read)
                    void getDataSource().markNotificationsRead([n.id]);
                  openTarget(navigationRef, notificationTarget(n));
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: t.colors.border,
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: t.radius.md,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: n.read
                      ? t.colors.surfaceSunken
                      : t.colors.brandSubtle,
                  }}
                >
                  <Icon
                    size={16}
                    color={n.read ? t.colors.textMuted : t.colors.brand}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    variant={n.read ? "body" : "bodyStrong"}
                    tone={n.read ? "secondary" : "primary"}
                    numberOfLines={1}
                  >
                    {n.title}
                  </Text>
                  <Text variant="caption" tone="muted" numberOfLines={1}>
                    {n.body}
                  </Text>
                </View>
                <Text variant="caption" tone="muted">
                  {formatRelative(n.createdAt)}
                </Text>
                {!n.read && (
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: t.colors.brand,
                    }}
                  />
                )}
              </Pressable>
            );
          })
        )}
      </Card>
    </Screen>
  );
}
