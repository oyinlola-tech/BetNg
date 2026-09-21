import { NavLink, Outlet } from "react-router";
import { Activity, Bell, KeyRound, MonitorSmartphone, SlidersHorizontal, UserRound } from "lucide-react";
import { Avatar, SectionHeader, StatusBadge, cn } from "@betng/ui-web";
import { useAuth } from "../auth/useAuth";

const SECTIONS = [
  { to: "/account/profile", label: "Profile", icon: UserRound },
  { to: "/account/preferences", label: "Preferences", icon: SlidersHorizontal },
  { to: "/account/security", label: "Security", icon: KeyRound },
  { to: "/account/sessions", label: "Sessions", icon: MonitorSmartphone },
  { to: "/account/notifications", label: "Notifications", icon: Bell },
  { to: "/account/activity", label: "Activity", icon: Activity },
] as const;

export function AccountLayout(): React.JSX.Element {
  const { user } = useAuth();

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
              {SECTIONS.map((section) => (
                <li key={section.to} className="shrink-0">
                  <NavLink
                    to={section.to}
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
