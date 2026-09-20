import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  BetSlipSheet,
  ConnectionBanner,
  ToastProvider,
  useToast,
} from "./components";
import { openAuth, useAuth } from "./hooks/useAuth";
import { RootNavigator } from "./navigation/RootNavigator";
import { useBetSlip } from "./stores/betslip.store";
import { hydrateStorage } from "./services/storage";
import { useTheme, useThemeStore } from "./theme";

function Body(): React.JSX.Element {
  const { toast } = useToast();
  const { status } = useAuth();

  useEffect(() => {
    if (status !== "EXPIRED") return;

    useBetSlip.getState().setOpen(false);
    openAuth("expired");
  }, [status]);

  return (
    <>
      <ConnectionBanner />
      <RootNavigator />
      <BetSlipSheet
        onPlaced={(message) => {
          toast(message, "success");
        }}
      />
    </>
  );
}

export function App(): React.JSX.Element {
  const [ready, setReady] = useState(false);
  const t = useTheme();

  useEffect(() => {
    void hydrateStorage().then(() => {
      useThemeStore.setState((s) => ({ ...s }));
      setReady(true);
    });
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style={t.name === "dark" ? "light" : "dark"} />
      {ready ? (
        <ToastProvider>
          <Body />
        </ToastProvider>
      ) : (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: t.colors.background,
          }}
        >
          <ActivityIndicator color={t.colors.textMuted} />
        </View>
      )}
    </SafeAreaProvider>
  );
}
