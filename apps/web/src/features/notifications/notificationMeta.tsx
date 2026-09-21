import { Bell, Ticket, Trophy, Wallet } from "lucide-react";
import type { NotificationView } from "@betng/ui-core";
import { FullTime, Goal, Kickoff } from "@betng/ui-web";

export type NotificationGroup = "bet" | "wallet" | "match" | "system";

export function notificationGroup(kind: string): NotificationGroup {
  if (kind.startsWith("BET")) return "bet";
  if (kind.startsWith("WALLET") || kind.startsWith("PAYMENT")) return "wallet";
  if (kind.startsWith("MATCH") || kind.startsWith("RESULT")) return "match";

  return "system";
}

export const GROUP_LABELS: Readonly<Record<NotificationGroup, string>> = {
  bet: "Bet",
  wallet: "Wallet",
  match: "Match",
  system: "System",
};

export function NotificationIcon({ notification }: { readonly notification: NotificationView }): React.JSX.Element {
  switch (notification.kind) {
    case "MATCH_STARTING":
      return <Kickoff size={18} />;
    case "MATCH_FINISHED":
      return <FullTime size={18} />;
    case "MATCH_EVENT":
      return <Goal size={18} />;
    case "RESULT_AVAILABLE":
      return <Trophy className="size-4" aria-hidden />;
    case "BET_SETTLED":
      return <Ticket className="size-4" aria-hidden />;
    default:
      return notificationGroup(notification.kind) === "wallet" ? <Wallet className="size-4" aria-hidden /> : <Bell className="size-4" aria-hidden />;
  }
}

export function notificationTarget(notification: NotificationView): string | undefined {
  if (notification.betId !== undefined) return `/tickets/${notification.betId}`;
  if (notification.matchId !== undefined) return `/matches/${notification.matchId}`;

  return undefined;
}
