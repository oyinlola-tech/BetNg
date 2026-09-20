import { View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Bell,
  ChevronRight,
  CircleHelp,
  History,
  Info,
  Receipt,
  Settings,
  Wallet,
} from "lucide-react-native";
import { formatMoney } from "@betng/ui-core";
import { Card, Divider, Pressable, Screen, Text } from "../components";
import { useAccountVersion } from "../hooks/useAccount";
import { useAsync } from "../hooks/useAsync";
import { getDataSource } from "../services/dataSource";
import { useTheme } from "../theme";

export function AccountScreen(): React.JSX.Element {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const version = useAccountVersion();
  const wallet = useAsync(() => getDataSource().getWallet(), [version], 15_000);
  const notifications = useAsync(
    () => getDataSource().listNotifications(),
    [version],
    15_000,
  );
  const unread = notifications.data?.filter((n) => !n.read).length ?? 0;

  const rows: readonly {
    readonly label: string;
    readonly hint?: string | undefined;
    readonly Icon: typeof Wallet;
    readonly onPress: () => void;
  }[] = [
    {
      label: "Wallet",
      hint:
        wallet.data === undefined
          ? undefined
          : formatMoney(wallet.data.available),
      Icon: Wallet,
      onPress: () => {
        navigation.navigate("Wallet");
      },
    },
    {
      label: "Transactions",
      Icon: Receipt,
      onPress: () => {
        navigation.navigate("Transactions");
      },
    },
    {
      label: "Notifications",
      hint: unread > 0 ? `${String(unread)} unread` : undefined,
      Icon: Bell,
      onPress: () => {
        navigation.navigate("Notifications");
      },
    },
    {
      label: "Watched matches",
      Icon: History,
      onPress: () => {
        navigation.navigate("History");
      },
    },
    {
      label: "Preferences & theme",
      Icon: Settings,
      onPress: () => {
        navigation.navigate("Settings");
      },
    },
  ];

  return (
    <Screen style={{ paddingTop: insets.top + 12 }}>
      <Text variant="caps" tone="muted">
        Demo user
      </Text>
      <Text variant="heading">Account</Text>
      <Card style={{ marginTop: 14, padding: 16 }}>
        <Text variant="caps" tone="muted">
          Simulated balance
        </Text>
        <Text variant="display" tabular style={{ marginTop: 4 }}>
          {wallet.data === undefined ? "…" : formatMoney(wallet.data.available)}
        </Text>
        <Text variant="caption" tone="muted" style={{ marginTop: 4 }}>
          Play-money. Nothing here has real-world value.
        </Text>
      </Card>
      <Card style={{ marginTop: 14 }}>
        {rows.map((row, i) => (
          <View key={row.label}>
            {i > 0 && <Divider />}
            <Pressable
              accessibilityRole="button"
              onPress={row.onPress}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingHorizontal: 14,
                height: 52,
              }}
            >
              <row.Icon size={18} color={t.colors.textSecondary} />
              <Text variant="body" style={{ flex: 1, fontWeight: "500" }}>
                {row.label}
              </Text>
              {row.hint !== undefined && (
                <Text variant="caption" tone="muted" tabular>
                  {row.hint}
                </Text>
              )}
              <ChevronRight size={16} color={t.colors.textMuted} />
            </Pressable>
          </View>
        ))}
      </Card>
      <Card style={{ marginTop: 14 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingHorizontal: 14,
            height: 52,
          }}
        >
          <CircleHelp size={18} color={t.colors.textSecondary} />
          <Text variant="body" style={{ flex: 1, fontWeight: "500" }}>
            Help
          </Text>
          <Text variant="caption" tone="muted">
            Matches run every 4 minutes
          </Text>
        </View>
        <Divider />
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingHorizontal: 14,
            paddingVertical: 14,
          }}
        >
          <Info size={18} color={t.colors.textSecondary} />
          <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
            BetNG is a portfolio simulation of a virtual football platform. No
            real money is involved.
          </Text>
        </View>
      </Card>
    </Screen>
  );
}
