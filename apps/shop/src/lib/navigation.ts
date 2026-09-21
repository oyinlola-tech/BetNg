import type { ShopPermission } from "@betng/contracts";
import { Banknote, BarChart3, CalendarCheck, CircleDot, ClipboardList, FilePlus2, FileText, Gauge, HandCoins, KeyRound, Radio, Receipt, ReceiptText, ScanLine, Trophy, UserRound, type LucideIcon } from "lucide-react";

export interface NavItem {
  readonly to: string;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly permission?: ShopPermission;
  readonly shortcut?: string;
}

export interface NavGroup {
  readonly label: string;
  readonly items: readonly NavItem[];
}

export const NAVIGATION: readonly NavGroup[] = [
  { label: "Overview", items: [{ to: "/", label: "Dashboard", icon: Gauge }] },
  {
    label: "Betting",
    items: [
      { to: "/betting/football", label: "Football", icon: CircleDot, permission: "tickets:sell" },
      { to: "/betting/virtual", label: "Virtual Football", icon: Trophy, permission: "tickets:sell" },
      { to: "/betting/live", label: "Live", icon: Radio, permission: "tickets:sell" },
    ],
  },
  {
    label: "Tickets",
    items: [
      { to: "/tickets/new", label: "New Ticket", icon: FilePlus2, permission: "tickets:sell", shortcut: "F2" },
      { to: "/betslip", label: "Bet Slip", icon: Receipt, permission: "tickets:sell" },
      { to: "/tickets/open", label: "Open Tickets", icon: ClipboardList, permission: "tickets:check" },
      { to: "/tickets/check", label: "Check Ticket", icon: ScanLine, permission: "tickets:check", shortcut: "F3" },
      { to: "/tickets/results", label: "Results", icon: CalendarCheck, shortcut: "F6" },
    ],
  },
  {
    label: "Cashier",
    items: [
      { to: "/cashier/payout", label: "Payout", icon: HandCoins, permission: "tickets:payout", shortcut: "F4" },
      { to: "/cashier/transactions", label: "Transactions", icon: ReceiptText, permission: "transactions:read" },
    ],
  },
  {
    label: "Reports",
    items: [
      { to: "/reports/daily", label: "Daily Report", icon: FileText, permission: "reports:read" },
      { to: "/reports/sales", label: "Sales", icon: BarChart3, permission: "reports:read" },
      { to: "/reports/payouts", label: "Payouts", icon: Banknote, permission: "reports:read" },
    ],
  },
  {
    label: "Account",
    items: [
      { to: "/account/profile", label: "Profile", icon: UserRound },
      { to: "/account/security", label: "Security", icon: KeyRound },
    ],
  },
];
