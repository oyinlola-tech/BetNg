import { Bell, CircleAlert, Gauge, IdCard, ShieldAlert, Ticket, Trophy, Wallet } from "lucide-react";
import type { NotificationView } from "@betng/ui-core";
import { FullTime, Goal, Kickoff } from "@betng/ui-web";
import { validReference } from "../payments/paymentMeta";

export type NotificationGroup = "bet" | "wallet" | "match" | "account" | "system";

/* Kinds the platform may add (bet, payment, KYC, security, limits) are matched by prefix; anything unrecognised is shown neutrally. */
export function notificationGroup(kind: string): NotificationGroup {
  if (kind.startsWith("BET")) return "bet";
  if (kind.startsWith("WALLET") || kind.startsWith("PAYMENT") || kind.startsWith("DEPOSIT") || kind.startsWith("WITHDRAWAL")) return "wallet";
  if (kind.startsWith("MATCH") || kind.startsWith("RESULT")) return "match";
  if (kind.startsWith("KYC") || kind.startsWith("SECURITY") || kind.startsWith("LIMIT")) return "account";

  return "system";
}

export const GROUP_LABELS: Readonly<Record<NotificationGroup, string>> = {
  bet: "Bet",
  wallet: "Wallet",
  match: "Match",
  account: "Account",
  system: "Notice",
};

/** Failure and security kinds get a warning treatment; the words come from the platform's title and body. */
export function notificationTone(kind: string): "neutral" | "warning" {
  return kind.endsWith("_FAILED") || kind.startsWith("SECURITY") || kind.startsWith("LIMIT") ? "warning" : "neutral";
}

export function NotificationIcon({ notification }: { readonly notification: NotificationView }): React.JSX.Element {
  const kind: string = notification.kind;

  switch (kind) {
    case "MATCH_STARTING":
      return <Kickoff size={18} />;
    case "MATCH_FINISHED":
      return <FullTime size={18} />;
    case "MATCH_EVENT":
      return <Goal size={18} />;
    case "RESULT_AVAILABLE":
      return <Trophy className="size-4" aria-hidden />;
    default:
      break;
  }

  if (kind.startsWith("SECURITY")) return <ShieldAlert className="size-4" aria-hidden />;
  if (kind.startsWith("KYC")) return <IdCard className="size-4" aria-hidden />;
  if (kind.startsWith("LIMIT")) return <Gauge className="size-4" aria-hidden />;
  if (kind.endsWith("_FAILED")) return <CircleAlert className="size-4" aria-hidden />;

  switch (notificationGroup(kind)) {
    case "bet":
      return <Ticket className="size-4" aria-hidden />;
    case "wallet":
      return <Wallet className="size-4" aria-hidden />;
    default:
      return <Bell className="size-4" aria-hidden />;
  }
}

export function notificationTarget(notification: NotificationView): string | undefined {
  const kind: string = notification.kind;

  if (notification.betId !== undefined) return `/tickets/${notification.betId}`;
  if (notification.matchId !== undefined) return `/matches/${notification.matchId}`;
  if (kind.startsWith("KYC")) return "/kyc";
  if (kind.startsWith("LIMIT")) return "/responsible-gaming";
  if (kind.startsWith("SECURITY")) return "/account/sessions";
  if (kind.startsWith("PAYMENT") || kind.startsWith("DEPOSIT") || kind.startsWith("WITHDRAWAL")) {
    const reference = validReference(notification.paymentReference);

    return reference === undefined ? "/payments" : `/payments/${reference}`;
  }
  if (notificationGroup(kind) === "wallet") return "/transactions";

  return undefined;
}
