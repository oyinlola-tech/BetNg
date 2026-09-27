import Constants, { ExecutionEnvironment } from "expo-constants";
import type * as ExpoNotifications from "expo-notifications";
import { Platform } from "react-native";
import type { PushNotifications, PushPermission } from "./pushNotifications";

type Notifications = typeof ExpoNotifications;

/** Expo Go is signed by Expo, not by BETNG: it carries none of our push credentials, so a token from it reaches nobody. */
export function runsInExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

function permissionOf(status: { readonly granted: boolean; readonly canAskAgain: boolean }): PushPermission {
  if (status.granted) return "granted";

  return status.canAskAgain ? "undetermined" : "denied";
}

/**
 * Push through the operating system. The module loads on first use, so a build without it costs nothing at start.
 * The platform sends through FCM, which addresses an Android device by the token this returns. An iPhone's native
 * token is an APNs token, which FCM cannot address, so none is offered there.
 */
export function createExpoPushNotifications(): PushNotifications {
  let loading: Promise<Notifications> | undefined;

  const load = (): Promise<Notifications> => {
    loading ??= import("expo-notifications").then(async (notifications) => {
      notifications.setNotificationHandler({
        handleNotification: () =>
          Promise.resolve({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
      });

      if (Platform.OS === "android") {
        await notifications.setNotificationChannelAsync("default", {
          name: "Alerts",
          importance: notifications.AndroidImportance.HIGH,
        });
      }

      return notifications;
    });

    return loading;
  };

  return {
    permission: async () => {
      try {
        return permissionOf(await (await load()).getPermissionsAsync());
      } catch {
        return "unavailable";
      }
    },
    requestPermission: async () => {
      try {
        return permissionOf(await (await load()).requestPermissionsAsync());
      } catch {
        return "unavailable";
      }
    },
    deviceToken: async () => {
      if (Platform.OS !== "android") return undefined;

      try {
        const token = await (await load()).getDevicePushTokenAsync();

        return typeof token.data === "string" ? token.data : undefined;
      } catch {
        return undefined;
      }
    },
    onTap: (listener) => {
      let active = true;
      let remove: (() => void) | undefined;

      void load()
        .then((notifications) => {
          if (!active) return;

          const launched = notifications.getLastNotificationResponse();

          if (launched !== null) listener(launched.notification.request.content.data);

          const subscription = notifications.addNotificationResponseReceivedListener((response) => {
            listener(response.notification.request.content.data);
          });

          remove = () => {
            subscription.remove();
          };
        })
        .catch(() => undefined);

      return () => {
        active = false;
        remove?.();
      };
    },
  };
}
