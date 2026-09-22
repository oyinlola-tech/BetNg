import { useState } from "react";
import { Switch, View } from "react-native";
import { Monitor, Moon, Sun } from "lucide-react-native";
import type { NotificationPreferences } from "@betng/ui-core";
import {
  Card,
  Divider,
  Pressable,
  PushNotificationsCard,
  Screen,
  Text,
} from "../components";
import { useAsync } from "../hooks/useAsync";
import { getDataSource } from "../services/dataSource";
import { useTheme, useThemeStore, type ThemePreference } from "../theme";
import { env } from "../configs/env";
import { useDevicePreferences } from "../stores/preferences.store";

const SHOW_DIAGNOSTICS = (env.appEnv === "development" && __DEV__) || env.appEnv === "test";

const THEMES: readonly {
  readonly value: ThemePreference;
  readonly label: string;
  readonly Icon: typeof Sun;
}[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

export function SettingsScreen(): React.JSX.Element {
  const t = useTheme();
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);
  const haptics = useDevicePreferences((s) => s.haptics);
  const setHaptics = useDevicePreferences((s) => s.setHaptics);
  const prefs = useAsync(
    () => getDataSource().getNotificationPreferences(),
    [],
  );
  const [local, setLocal] = useState<NotificationPreferences | undefined>(
    undefined,
  );
  const current = local ?? prefs.data;

  const update = (key: keyof NotificationPreferences, value: boolean): void => {
    if (current === undefined) return;

    const next = { ...current, [key]: value };

    setLocal(next);
    void getDataSource().setNotificationPreferences(next);
  };

  const row = (
    key: keyof NotificationPreferences,
    label: string,
    hint: string,
  ): React.JSX.Element => (
    <View
      key={key}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 14,
        paddingVertical: 10,
        gap: 12,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text variant="body" style={{ fontWeight: "500" }}>
          {label}
        </Text>
        <Text variant="caption" tone="muted">
          {hint}
        </Text>
      </View>
      <Switch
        value={current?.[key] ?? false}
        onValueChange={(v) => {
          update(key, v);
        }}
        disabled={current === undefined}
        trackColor={{ true: t.colors.brand, false: t.colors.borderStrong }}
        thumbColor="#fff"
        accessibilityLabel={label}
      />
    </View>
  );

  return (
    <Screen>
      <Text variant="caps" tone="muted" style={{ marginBottom: 8 }}>
        Theme
      </Text>
      <View
        style={{
          flexDirection: "row",
          gap: 2,
          padding: 2,
          borderRadius: t.radius.sm,
          backgroundColor: t.colors.surfaceSunken,
        }}
      >
        {THEMES.map(({ value, label, Icon }) => {
          const active = preference === value;

          return (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              onPress={() => {
                setPreference(value);
              }}
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                height: 40,
                borderRadius: t.radius.xs,
                backgroundColor: active ? t.colors.surface : "transparent",
              }}
            >
              <Icon
                size={16}
                color={active ? t.colors.textPrimary : t.colors.textMuted}
              />
              <Text
                variant="caption"
                tone={active ? "primary" : "muted"}
                style={{ fontWeight: "600" }}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text
        variant="caps"
        tone="muted"
        style={{ marginTop: 22, marginBottom: 8 }}
      >
        Notifications
      </Text>
      <Card>
        {row(
          "matchStarting",
          "Match starting",
          "When a match you follow is about to kick off",
        )}
        <Divider />
        {row(
          "matchFinished",
          "Full time",
          "Final scores for matches you follow",
        )}
        <Divider />
        {row(
          "betSettled",
          "Bet settled",
          "When a simulated bet wins, loses or is voided",
        )}
        <Divider />
        {row("goals", "Goals", "Every goal in matches you are watching")}
      </Card>
      <PushNotificationsCard />

      <Text
        variant="caps"
        tone="muted"
        style={{ marginTop: 22, marginBottom: 8 }}
      >
        Device
      </Text>
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text variant="body" style={{ fontWeight: "500" }}>
              Vibration
            </Text>
            <Text variant="caption" tone="muted">
              A short buzz when a bet is accepted, a double one when it is not
            </Text>
          </View>
          <Switch
            value={haptics}
            onValueChange={setHaptics}
            trackColor={{ true: t.colors.brand, false: t.colors.borderStrong }}
            thumbColor="#fff"
            accessibilityLabel="Vibration"
          />
        </View>
      </Card>

      {SHOW_DIAGNOSTICS && (
        <>
          <Text
            variant="caps"
            tone="muted"
            style={{ marginTop: 22, marginBottom: 8 }}
          >
            Platform
          </Text>
          <Card style={{ padding: 14, gap: 4 }}>
            <Text variant="caption" tone="secondary">
              Data source ·{" "}
              <Text variant="caption" style={{ fontWeight: "600" }}>
                BetNG platform
              </Text>
            </Text>
            <Text variant="caption" tone="secondary">
              Gateway · {env.apiUrl}
            </Text>
          </Card>
        </>
      )}
      <Text variant="caption" tone="muted" style={{ marginTop: 16 }}>
        BetNG is a portfolio simulation. Balances, stakes and returns are
        play-money.
      </Text>
    </Screen>
  );
}
