import { Linking } from "react-native";
import type { NavigationContainerRefWithCurrent } from "@react-navigation/native";
import type { RootStackParamList } from "../navigation/types";
import { hostsFromSiteUrl, parseDeepLink, type DeepLinkOptions, type DeepLinkTarget } from "./deepLinks";

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
    if (ref.isReady()) openTarget(ref, parsed.target);
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
