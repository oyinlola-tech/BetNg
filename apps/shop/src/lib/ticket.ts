import type { Ticket, TicketStatus } from "@betng/contracts";
import type { StatusTone } from "@betng/ui-web";

export const TICKET_STATUS: Readonly<Record<TicketStatus, { readonly label: string; readonly tone: StatusTone; readonly description: string }>> = {
  PENDING: { label: "Pending", tone: "warning", description: "The ticket is being accepted." },
  OPEN: { label: "Open", tone: "brand", description: "At least one match has not finished." },
  WON: { label: "Won", tone: "success", description: "Every selection won. Ready to pay out." },
  LOST: { label: "Lost", tone: "danger", description: "At least one selection lost." },
  VOID: { label: "Void", tone: "warning", description: "The ticket was voided. The stake is refundable." },
  CANCELLED: { label: "Cancelled", tone: "neutral", description: "Cancelled at the counter before kick-off." },
  PAID: { label: "Paid", tone: "neutral", description: "Winnings have been collected." },
  EXPIRED: { label: "Expired", tone: "neutral", description: "The collection window has passed." },
};

export type CheckVerdict = "WINNING" | "LOSING" | "OPEN" | "VOID" | "ALREADY_PAID" | "CANCELLED" | "EXPIRED";

export function verdictFor(ticket: Ticket): CheckVerdict {
  switch (ticket.status) {
    case "WON":
      return "WINNING";
    case "LOST":
      return "LOSING";
    case "PAID":
      return "ALREADY_PAID";
    case "VOID":
      return "VOID";
    case "CANCELLED":
      return "CANCELLED";
    case "EXPIRED":
      return "EXPIRED";
    case "OPEN":
    case "PENDING":
      return "OPEN";
  }
}

export function isPayable(ticket: Ticket): boolean {
  return ticket.status === "WON" || ticket.status === "VOID";
}

export function normaliseCode(input: string): string {
  const compact = input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

  return compact.startsWith("BNG") && compact.length > 3 ? `BNG-${compact.slice(3)}` : compact;
}

export function localDateKey(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);

  return `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Axis ticks have about six characters of room: ₦0, ₦125k, ₦1.2m. */
export function formatAxisMoney(minorUnits: number): string {
  const naira = minorUnits / 100;
  const abs = Math.abs(naira);

  if (abs >= 1_000_000) return `₦${(naira / 1_000_000).toFixed(abs % 1_000_000 === 0 ? 0 : 1)}m`;
  if (abs >= 1_000) return `₦${(naira / 1_000).toFixed(abs % 1_000 === 0 ? 0 : 1)}k`;

  return `₦${String(Math.round(naira))}`;
}
