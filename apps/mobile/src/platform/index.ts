import { createUnavailableBiometrics } from "./biometrics";
import { createCrashReporter } from "./crashReporting";
import { createUnavailablePushNotifications } from "./pushNotifications";
import { createMemorySecureStorage } from "./secureStorage";

export const secureStorage = createMemorySecureStorage();
export const biometrics = createUnavailableBiometrics();
export const pushNotifications = createUnavailablePushNotifications();
export const crashReporter = createCrashReporter();

export { confirmPresence } from "./biometrics";
export { registerForPush } from "./pushNotifications";
export type { PushRegistration } from "./pushNotifications";
export { OFFLINE_COMMAND_MESSAGE, canRunFinancialCommand } from "./offlineCache";
