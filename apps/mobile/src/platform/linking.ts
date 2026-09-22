import { Linking } from "react-native";
import type { NavigationContainerRefWithCurrent } from "@react-navigation/native";
import type { RootStackParamList } from "../navigation/types";
import { hostsFromSiteUrl, parseDeepLink, type DeepLinkOptions, type DeepLinkTarget } from "./deepLinks";
import { notificationTarget } from "./notificationRoutes";
import type { PushNotifications } from "./pushNotifications";

export function deepLinkOptions(siteUrl: string | undefined): DeepLinkOptions {
  return { schemes: ["betng"], hosts: hostsFromSiteUrl(siteUrl) };
}

export function openTarget(ref: NavigationContainerRefWithCurrent<RootStackParamList>, target: DeepLinkTarget): void {
  switch (target.name) {
    case "Home":
      ref.navigate("Tabs", { screen: "Home" });
      return;
    case "Results":
      ref.navigate("Results", {});
      return;
    case "Bets":
      ref.navigate("Tabs", { screen: "Bets" });
      return;
    case "Account":
      ref.navigate("Tabs", { screen: "Account" });
      return;
    case "Wallet":
      ref.navigate("Wallet");
      return;
    case "Match":
      ref.navigate("Match", { matchId: target.matchId });
      return;
    case "Bet":
      ref.navigate("Bet", { betId: target.betId });
      return;
    case "Payment":
      ref.navigate("Payment", { reference: target.reference });
      return;
  }
}

function whenReady(ref: NavigationContainerRefWithCurrent<RootStackParamList>, target: DeepLinkTarget, isActive: () => boolean): void {
  const open = (attempt: number): void => {
    if (!isActive()) return;
    if (ref.isReady()) openTarget(ref, target);
    else if (attempt < 50) setTimeout(() => {
      open(attempt + 1);
    }, 100);
  };

  open(0);
}

/** Opens the launch link once navigation is ready, then every link that arrives while running. */
export function listenForDeepLinks(
  ref: NavigationContainerRefWithCurrent<RootStackParamList>,
  options: DeepLinkOptions,
  onRejected: () => void,
): () => void {
  let active = true;

  const handle = (url: string | null): void => {
    if (!active || url === null) return;

    const parsed = parseDeepLink(url, options);

    if (!parsed.accepted) onRejected();

    whenReady(ref, parsed.target, () => active);
  };

  void Linking.getInitialURL()
    .then(handle)
    .catch(() => undefined);

  const subscription = Linking.addEventListener("url", ({ url }) => {
    handle(url);
  });

  return () => {
    active = false;
    subscription.remove();
  };
}

/** Routes a tapped push notification by its kind and ids, the same way a tap in the notification list does. */
export function listenForNotificationTaps(ref: NavigationContainerRefWithCurrent<RootStackParamList>, push: PushNotifications): () => void {
  let active = true;
  const unsubscribe = push.onTap((data) => {
    whenReady(ref, notificationTarget(data), () => active);
  });

  return () => {
    active = false;
    unsubscribe();
  };
}
