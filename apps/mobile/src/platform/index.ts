import { Vibration } from "react-native";
import { useDevicePreferences } from "../stores/preferences.store";
import { createUnavailableBiometrics } from "./biometrics";
import { createHaptics } from "./haptics";
import { createCrashReporter } from "./crashReporting";
import { createExpoPushNotifications, runsInExpoGo } from "./expoPushNotifications";
import { createUnavailablePushNotifications } from "./pushNotifications";
import { createMemorySecureStorage } from "./secureStorage";

export const secureStorage = createMemorySecureStorage();
export const biometrics = createUnavailableBiometrics();
export const pushNotifications = runsInExpoGo() ? createUnavailablePushNotifications() : createExpoPushNotifications();
export const crashReporter = createCrashReporter();
export const haptics = createHaptics(
  (pattern) => {
    Vibration.vibrate(typeof pattern === "number" ? pattern : [...pattern]);
  },
  () => useDevicePreferences.getState().haptics,
);

export { confirmPresence } from "./biometrics";
export { runsInExpoGo } from "./expoPushNotifications";
export { registerForPush } from "./pushNotifications";
export type { PushRegistration } from "./pushNotifications";
export { OFFLINE_COMMAND_MESSAGE, canRunFinancialCommand } from "./offlineCache";
