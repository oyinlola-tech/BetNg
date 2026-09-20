import type { AdminPermission } from "@betng/contracts";
import {
  Activity,
  Banknote,
  BarChart3,
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  Cpu,
  Gauge,
  HeartPulse,
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
}

export interface NavGroup {
  readonly label: string;
  readonly items: readonly NavItem[];
}

export const NAV: readonly NavGroup[] = [
  { label: "Overview", items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard }] },
  {
    label: "People & Shops",
    items: [
      { to: "/users", label: "Users", icon: Users, permission: "users:read" },
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
    ],
  },
  {
    label: "Operations",
    items: [
      { to: "/simulation", label: "Simulation", icon: Cpu, permission: "simulation:read" },
      { to: "/live", label: "Live Control", icon: Radio, permission: "fixtures:read" },
      { to: "/settlement", label: "Settlement", icon: CircleDollarSign, permission: "settlement:read" },
    ],
  },
  {
    label: "Finance",
    items: [
      { to: "/wallet", label: "Wallet", icon: Banknote, permission: "wallet:read" },
      { to: "/reports", label: "Reports", icon: BarChart3, permission: "reports:read" },
    ],
  },
  {
    label: "Platform",
    items: [
      { to: "/audit", label: "Audit Logs", icon: ScrollText, permission: "audit:read" },
      { to: "/health", label: "System Health", icon: HeartPulse, permission: "health:read" },
      { to: "/settings", label: "Settings", icon: Settings, permission: "settings:read" },
    ],
  },
];

export const ActivityIcon = Activity;

export const ROLE_LABELS: Readonly<Record<string, string>> = {
  SUPER_ADMIN: "Super admin",
  OPERATIONS: "Operations",
  RISK_ANALYST: "Risk analyst",
  SUPPORT: "Support",
};
