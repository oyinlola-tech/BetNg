import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  BetSlipSheet,
  ConnectionBanner,
  Text,
  ToastProvider,
  useToast,
} from "./components";
import { openAuth, useAuth } from "./hooks/useAuth";
import { RootNavigator } from "./navigation/RootNavigator";
import { useBetSlip } from "./stores/betslip.store";
import { initRuntime } from "./services/dataSource";
import { crashReporter } from "./platform";
import { logger } from "./services/logger";
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
  const [failed, setFailed] = useState(false);
  const t = useTheme();

  useEffect(() => {
    hydrateStorage()
      .then(() => {
        useThemeStore.setState((s) => ({ ...s }));

        return initRuntime();
      })
      .then(() => {
        setReady(true);
      })
      .catch((cause: unknown) => {
        crashReporter.captureException(cause, { phase: "startup" });
        logger.error("flow", "The app could not start", { cause: cause instanceof Error ? cause.message : "unknown" });
        setFailed(true);
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
          {failed ? (
            <Text variant="body" tone="secondary" align="center" style={{ paddingHorizontal: 32 }}>
              BETNG could not start. Close the app and open it again.
            </Text>
          ) : (
            <ActivityIndicator color={t.colors.textMuted} accessibilityLabel="Starting" />
          )}
        </View>
      )}
    </SafeAreaProvider>
  );
}
