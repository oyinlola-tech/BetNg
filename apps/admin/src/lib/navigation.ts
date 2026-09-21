import type { AdminPermission } from "@betng/contracts";
import type { FeatureFlag } from "@betng/ui-core";
import {
  Banknote,
  BarChart3,
  CreditCard,
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  Cpu,
  Gauge,
  HandHeart,
  HeartPulse,
  IdCard,
  LayoutDashboard,
  ListChecks,
  Radio,
  ScrollText,
  Settings,
  Shield,
  ShieldAlert,
  Store,
  Trophy,
  Users,
  UserSquare,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  readonly to: string;
  readonly label: string;
  readonly icon: LucideIcon;
  /** The read permission that reveals the item. Absent means every signed-in admin. */
  readonly permission?: AdminPermission;
  /** A platform feature flag that must be on for the item to show. */
  readonly flag?: FeatureFlag;
}

export interface NavGroup {
  readonly label: string;
  readonly items: readonly NavItem[];
}

export const NAV: readonly NavGroup[] = [
  { label: "Overview", items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard }] },
  {
    label: "Customers",
    items: [
      { to: "/users", label: "Users", icon: Users, permission: "users:read" },
      { to: "/kyc", label: "KYC", icon: IdCard, permission: "kyc:read", flag: "complianceEnabled" },
      { to: "/responsible-gaming", label: "Responsible Gaming", icon: HandHeart, permission: "users:read", flag: "complianceEnabled" },
    ],
  },
  {
    label: "Retail",
    items: [
      { to: "/shops", label: "Shops", icon: Store, permission: "shops:read" },
      { to: "/cashiers", label: "Cashiers", icon: UserSquare, permission: "shops:read" },
    ],
  },
  {
    label: "Catalogue",
    items: [
      { to: "/leagues", label: "Leagues", icon: Trophy, permission: "catalogue:read" },
      { to: "/teams", label: "Teams", icon: Shield, permission: "catalogue:read" },
      { to: "/fixtures", label: "Fixtures", icon: CalendarDays, permission: "fixtures:read" },
    ],
  },
  {
    label: "Trading",
    items: [
      { to: "/matches", label: "Matches", icon: ClipboardList, permission: "fixtures:read" },
      { to: "/markets", label: "Markets", icon: ListChecks, permission: "odds:read" },
      { to: "/odds", label: "Odds", icon: Gauge, permission: "odds:read" },
      { to: "/risk", label: "Risk", icon: ShieldAlert, permission: "risk:read" },
      { to: "/live", label: "Live Control", icon: Radio, permission: "fixtures:read" },
    ],
  },
  {
    label: "Operations",
    items: [
      { to: "/simulation", label: "Simulation", icon: Cpu, permission: "simulation:read" },
      { to: "/settlement", label: "Settlement", icon: CircleDollarSign, permission: "settlement:read" },
    ],
  },
  {
    label: "Finance",
    items: [
      { to: "/wallet", label: "Wallet", icon: Banknote, permission: "wallet:read" },
      { to: "/payments", label: "Payments", icon: CreditCard, permission: "payments:read", flag: "complianceEnabled" },
      { to: "/reports", label: "Reports", icon: BarChart3, permission: "reports:read" },
    ],
  },
  {
    label: "System",
    items: [
      { to: "/audit", label: "Audit Logs", icon: ScrollText, permission: "audit:read" },
      { to: "/health", label: "System Health", icon: HeartPulse, permission: "health:read" },
      { to: "/settings", label: "Settings", icon: Settings, permission: "settings:read" },
    ],
  },
];

const DETAIL_LABELS: Readonly<Record<string, string>> = {
  shops: "Shop detail",
  leagues: "League detail",
  matches: "Match control",
  teams: "Team",
};

export interface Crumb {
  readonly label: string;
  readonly to?: string;
}

export function crumbsFor(pathname: string): readonly Crumb[] {
  const [section, detail] = pathname.split("/").filter((part) => part !== "");

  if (section === undefined) return [{ label: "Overview" }, { label: "Dashboard" }];

  for (const group of NAV) {
    const item = group.items.find((candidate) => candidate.to === `/${section}`);

    if (item === undefined) continue;

    return detail === undefined ? [{ label: group.label }, { label: item.label }] : [{ label: group.label }, { label: item.label, to: item.to }, { label: DETAIL_LABELS[section] ?? "Detail" }];
  }

  return [{ label: "Not found" }];
}

export const ROLE_LABELS: Readonly<Record<string, string>> = {
  SUPER_ADMIN: "Super admin",
  OPERATIONS: "Operations",
  RISK_ANALYST: "Risk analyst",
  SUPPORT: "Support",
};

export function missingPermission(permission: AdminPermission): string {
  return `Requires the “${permission}” permission`;
}
