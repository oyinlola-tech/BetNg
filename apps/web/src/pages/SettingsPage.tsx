import { Link } from "react-router";
import { Bell, ChevronRight, KeyRound, LogOut, MonitorDown, SlidersHorizontal, UserRound, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button, Card, SectionHeader, SectionHeading, ThemeSwitcher } from "@betng/ui-web";
import { useAuth, useLogoutFlow } from "../features/auth";
import { usePageMeta } from "../features/seo";
import { useInstallApp } from "../layouts/shell/InstallApp";

const LINKS: readonly { readonly to: string; readonly label: string; readonly description: string; readonly icon: LucideIcon }[] = [
  { to: "/account/profile", label: "Profile", description: "Your name, email and account status", icon: UserRound },
  { to: "/account/preferences", label: "Display preferences", description: "Theme and date format on this device", icon: SlidersHorizontal },
  { to: "/account/notifications", label: "Notification preferences", description: "Which alerts your account receives", icon: Bell },
  { to: "/account/security", label: "Security", description: "Password and sign-in protection", icon: KeyRound },
  { to: "/wallet", label: "Wallet", description: "Simulated balance, deposits and withdrawals", icon: Wallet },
];

export function SettingsPage(): React.JSX.Element {
  usePageMeta({ title: "Settings", noindex: true });

  const { user, isAuthenticated, openAuth } = useAuth();
  const logout = useLogoutFlow();
  const installApp = useInstallApp();

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <SectionHeader as="h1" eyebrow="This device" title="Settings" />

      <Card>
        <SectionHeading as="h2">Appearance</SectionHeading>
        <p className="type-small mt-2 text-text-muted">Light, dark, or follow this device.</p>
        <ThemeSwitcher showLabels className="mt-3" />
      </Card>

      <Card padding="none">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <SectionHeading as="h2">Account</SectionHeading>
            <p className="type-small mt-1 truncate text-text-muted">
              {user === undefined ? "Browsing is open to everyone. An account is needed to bet and use the wallet." : `${user.displayName} · ${user.email}`}
            </p>
          </div>
          {isAuthenticated ? (
            <Button variant="secondary" size="sm" leadingIcon={<LogOut className="size-3.5" aria-hidden />} onClick={logout.request}>
              Sign out
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => {
                openAuth("login");
              }}
            >
              Sign in
            </Button>
          )}
        </div>
        <ul className="divide-y divide-border">
          {LINKS.map((item) => (
            <li key={item.to}>
              <Link to={item.to} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-hover focus-ring">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-surface-sunken text-text-secondary">
                  <item.icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="type-body block font-semibold text-text-primary">{item.label}</span>
                  <span className="type-small block truncate text-text-muted">{item.description}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-text-muted" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      {installApp.available && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <SectionHeading as="h2">App</SectionHeading>
              <p className="type-small mt-2 text-text-muted">Add BETNG to this device to open it from the home screen or app list.</p>
            </div>
            <Button variant="secondary" size="sm" leadingIcon={<MonitorDown className="size-3.5" aria-hidden />} onClick={installApp.install}>
              Install app
            </Button>
          </div>
        </Card>
      )}

      <Card>
        <SectionHeading as="h2">About</SectionHeading>
        <p className="type-small mt-2 text-text-secondary">BETNG is a simulated virtual football platform. Every balance, stake and payout is play money and nothing here has real-world value.</p>
      </Card>
      {logout.dialog}
    </div>
  );
}
