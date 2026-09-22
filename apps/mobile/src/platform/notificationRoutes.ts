import { targetForPath, type DeepLinkTarget } from "./deepLinks";

const MATCH_KINDS = new Set(["MATCH_STARTING", "MATCH_FINISHED", "RESULT_AVAILABLE", "MATCH_EVENT"]);
const BET_KINDS = new Set(["BET_ACCEPTED", "BET_SETTLED"]);
const ACCOUNT_KINDS = new Set(["KYC_UPDATED", "SECURITY_ALERT", "LIMIT_WARNING"]);

function field(source: Readonly<Record<string, unknown>>, key: string): string | undefined {
  const value = source[key];

  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function byId(route: "match" | "bet" | "payment", id: string | undefined): DeepLinkTarget | undefined {
  if (id === undefined) return undefined;

  const parsed = targetForPath(`/${route}/${id}`);

  return parsed.accepted ? parsed.target : undefined;
}

/** Where tapping a notification (in the list or from the OS) opens. Ids are validated like any deep link. */
export function notificationTarget(notification: unknown): DeepLinkTarget {
  if (notification === null || typeof notification !== "object") return { name: "Home" };

  const source = notification as Readonly<Record<string, unknown>>;
  const kind = field(source, "kind") ?? "";

  if (MATCH_KINDS.has(kind)) {
    return byId("match", field(source, "matchId")) ?? (kind === "RESULT_AVAILABLE" || kind === "MATCH_FINISHED" ? { name: "Results" } : { name: "Home" });
  }

  if (BET_KINDS.has(kind)) return byId("bet", field(source, "betId")) ?? { name: "Bets" };
  if (kind === "PAYMENT_UPDATED") return byId("payment", field(source, "paymentReference")) ?? { name: "Wallet" };
  if (ACCOUNT_KINDS.has(kind)) return { name: "Account" };

  return byId("match", field(source, "matchId")) ?? byId("bet", field(source, "betId")) ?? { name: "Home" };
}
