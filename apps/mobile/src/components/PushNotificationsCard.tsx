import { useState } from "react";
import { Platform } from "react-native";
import { useAuth } from "../hooks/useAuth";
import { useFlags } from "../hooks/useFlags";
import { presentError } from "../lib/errors";
import { pushNotifications, registerForPush } from "../platform";
import { getAccountServices } from "../services/dataSource";
import { Button } from "./Button";
import { Card } from "./Card";
import { Text } from "./Text";

const MESSAGES = {
  registered: "Push notifications are on for this device.",
  denied: "Notifications are blocked for BETNG. Allow them in your device settings, then try again.",
  unavailable: "Push notifications are not available in this build of the app.",
} as const;

export function PushNotificationsCard(): React.JSX.Element | null {
  const { isAuthenticated } = useAuth();
  const enabled = useFlags().notificationChannelsEnabled;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ readonly text: string; readonly tone: "secondary" | "danger" | "success" } | undefined>(undefined);

  if (!enabled || !isAuthenticated) return null;

  const enable = async (): Promise<void> => {
    setBusy(true);

    const result = await registerForPush(pushNotifications, getAccountServices().devices, {
      platform: Platform.OS === "ios" ? "ios" : "android",
      label: `${Platform.OS === "ios" ? "iPhone" : "Android"} app`,
    });

    setBusy(false);
    setMessage(
      result.status === "failed"
        ? { text: presentError(result.error).message, tone: "danger" }
        : { text: MESSAGES[result.status], tone: result.status === "registered" ? "success" : "secondary" },
    );
  };

  return (
    <Card style={{ padding: 14, gap: 10, marginTop: 12 }}>
      <Text variant="bodyStrong">Push notifications</Text>
      <Text variant="caption" tone="secondary">
        Get settlement, payment and security alerts on this device.
      </Text>
      {message !== undefined && (
        <Text variant="caption" tone={message.tone} accessibilityLiveRegion="polite">
          {message.text}
        </Text>
      )}
      <Button label="Turn on push notifications" variant="secondary" size="sm" loading={busy} onPress={() => void enable()} />
    </Card>
  );
}
