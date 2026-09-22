import { NavLink, Outlet } from "react-router";
import { Activity, Bell, FileText, Gauge, IdCard, KeyRound, Landmark, MonitorSmartphone, ReceiptText, SlidersHorizontal, UserRound, UserX, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { FeatureFlag } from "@betng/ui-core";
import { Avatar, SectionHeader, StatusBadge, cn, useFeatureFlags } from "@betng/ui-web";
import { useAuth } from "../auth/useAuth";

interface Section {
  readonly to: string;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly flag?: FeatureFlag;
  readonly end?: boolean;
}

const SECTIONS: readonly Section[] = [
  { to: "/account/profile", label: "Profile", icon: UserRound },
  { to: "/account/preferences", label: "Preferences", icon: SlidersHorizontal },
  { to: "/wallet", label: "Wallet", icon: Wallet, flag: "walletEnabled", end: true },
  { to: "/wallet/bank-accounts", label: "Bank accounts", icon: Landmark, flag: "paymentsEnabled" },
  { to: "/payments", label: "Payments", icon: ReceiptText, flag: "paymentsEnabled" },
  { to: "/statements", label: "Statements", icon: FileText, flag: "statementsEnabled" },
  { to: "/kyc", label: "Verification", icon: IdCard, flag: "kycEnabled" },
  { to: "/responsible-gaming", label: "Responsible gaming", icon: Gauge, flag: "responsibleGamingEnabled" },
  { to: "/account/security", label: "Security", icon: KeyRound },
  { to: "/account/sessions", label: "Sessions", icon: MonitorSmartphone },
  { to: "/account/notifications", label: "Notifications", icon: Bell },
  { to: "/account/activity", label: "Activity", icon: Activity },
  { to: "/account/delete", label: "Delete account", icon: UserX },
];

export function AccountLayout(): React.JSX.Element {
  const { user } = useAuth();
  const flags = useFeatureFlags();
  const sections = SECTIONS.filter((section) => section.flag === undefined || flags[section.flag]);

  return (
    <div className="space-y-5">
      <SectionHeader as="h1" eyebrow="Your account" title="Account" />
      <div className="grid gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="min-w-0 space-y-3">
          {user !== undefined && (
            <div className="flex items-center gap-3 rounded-md border border-border bg-surface p-3">
              <Avatar name={user.displayName} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="type-body truncate font-semibold text-text-primary">{user.displayName}</p>
                <p className="type-small truncate text-text-muted">{user.email}</p>
              </div>
              <StatusBadge status={user.status} className="lg:hidden" />
            </div>
          )}
          <nav aria-label="Account sections" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] lg:mx-0 lg:overflow-visible lg:px-0">
            <ul className="flex gap-1 lg:flex-col">
              {sections.map((section) => (
                <li key={section.to} className="shrink-0">
                  <NavLink
                    to={section.to}
                    end={section.end === true}
                    className={({ isActive }) =>
                      cn(
                        "flex h-10 items-center gap-2 whitespace-nowrap rounded-sm border px-3 text-sm font-semibold transition-colors focus-ring pointer-coarse:h-11",
                        isActive
                          ? "border-border-strong bg-surface text-text-primary"
                          : "border-transparent text-text-secondary hover:bg-surface-hover hover:text-text-primary",
                      )
                    }
                  >
                    <section.icon className="size-4 shrink-0" aria-hidden />
                    {section.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
