import { useState } from "react";
import { Alert, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Bell,
  ChevronRight,
  CircleHelp,
  History,
  Info,
  LogOut,
  Pencil,
  Receipt,
  Settings,
  Wallet,
} from "lucide-react-native";
import { formatMoney } from "@betng/ui-core";
import { Button, Card, Divider, Pressable, Screen, Text, useToast } from "../components";
import { useAccountVersion } from "../hooks/useAccount";
import { useAsync } from "../hooks/useAsync";
import { requireAuth, useAuth } from "../hooks/useAuth";
import { getDataSource } from "../services/dataSource";
import { useBetSlip } from "../stores/betslip.store";
import { useTheme } from "../theme";
import { EditProfile } from "./account/EditProfile";

export function AccountScreen(): React.JSX.Element {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const version = useAccountVersion();
  const { isAuthenticated, user, status, openAuth, logout } = useAuth();
  const { toast } = useToast();
  const selectionCount = useBetSlip((s) => s.selections.length);
  const [editing, setEditing] = useState(false);
  const wallet = useAsync(
    () => (isAuthenticated ? getDataSource().getWallet() : Promise.resolve(undefined)),
    [version, isAuthenticated],
    15_000,
  );
  const notifications = useAsync(
    () => (isAuthenticated ? getDataSource().listNotifications() : Promise.resolve([])),
    [version, isAuthenticated],
    15_000,
  );

  const gate = (label: string, to: "Wallet" | "Transactions" | "Notifications") => (): void => {
    requireAuth({
      reason: `Log in to open ${label}.`,
      run: () => {
        navigation.navigate(to);
      },
    });
  };

  const signOut = async (): Promise<void> => {
    await logout();
    toast("You are logged out");
  };

  const confirmLogout = (): void => {
    if (selectionCount === 0) return void signOut();

    Alert.alert("Log out?", `Your bet slip has ${String(selectionCount)} selection${selectionCount === 1 ? "" : "s"}. They stay on this device, but you will need to log in again to place the bet.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: () => void signOut() },
    ]);
  };
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
      onPress: gate("your wallet", "Wallet"),
    },
    {
      label: "Transactions",
      Icon: Receipt,
      onPress: gate("your transactions", "Transactions"),
    },
    {
      label: "Notifications",
      hint: unread > 0 ? `${String(unread)} unread` : undefined,
      Icon: Bell,
      onPress: gate("your notifications", "Notifications"),
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
      <Text variant="heading">Account</Text>
      {user === undefined ? (
        <Card style={{ marginTop: 14, padding: 16, gap: 12 }}>
          <Text variant="title">{status === "EXPIRED" ? "Your session has ended" : "Bet, track and manage in one place"}</Text>
          <Text variant="caption" tone="secondary">
            {status === "EXPIRED"
              ? "Log in again to pick up where you left off."
              : "Browsing is open to everyone. An account is only needed to place bets and use the wallet."}
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button
              label="Log in"
              style={{ flex: 1 }}
              onPress={() => {
                openAuth(status === "EXPIRED" ? "expired" : "login");
              }}
            />
            {status !== "EXPIRED" && (
              <Button
                label="Create account"
                variant="secondary"
                style={{ flex: 1 }}
                onPress={() => {
                  openAuth("register");
                }}
              />
            )}
          </View>
        </Card>
      ) : (
        <Card style={{ marginTop: 14, padding: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View
              accessible={false}
              style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: t.colors.brandSubtle }}
            >
              <Text variant="bodyStrong" tone="brand">
                {user.displayName
                  .split(/\s+/)
                  .map((part) => part[0] ?? "")
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="title" numberOfLines={1}>
                {user.displayName}
              </Text>
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {user.email}
              </Text>
              {user.phone !== undefined && (
                <Text variant="caption" tone="muted" numberOfLines={1}>
                  {user.phone}
                </Text>
              )}
            </View>
            {!editing && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Edit profile"
                onPress={() => {
                  setEditing(true);
                }}
                style={{ padding: 8 }}
              >
                <Pencil size={16} color={t.colors.textSecondary} />
              </Pressable>
            )}
          </View>
          {editing && (
            <EditProfile
              user={user}
              onDone={() => {
                setEditing(false);
              }}
            />
          )}
          <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: t.colors.border }}>
            <Text variant="caps" tone="muted">
              Available to bet
            </Text>
            <Text variant="display" tabular style={{ marginTop: 4 }}>
              {wallet.data === undefined ? "…" : formatMoney(wallet.data.available)}
            </Text>
            <Text variant="caption" tone="muted" style={{ marginTop: 4 }}>
              Available to bet
            </Text>
          </View>
        </Card>
      )}
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
            Every match is virtual football
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
            BETNG takes bets on virtual football: match outcomes come from the
            platform’s simulation. 18+. Bet responsibly.
          </Text>
        </View>
      </Card>
      {user !== undefined && (
        <Button label="Log out" variant="secondary" icon={<LogOut size={16} color={t.colors.textPrimary} />} onPress={confirmLogout} style={{ marginTop: 14 }} />
      )}
    </Screen>
  );
}
