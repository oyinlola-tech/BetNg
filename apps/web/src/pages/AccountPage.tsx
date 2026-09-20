import { Link } from "react-router";
import { Bell, ChevronRight, KeyRound, LogOut, Receipt, Wallet } from "lucide-react";
import { formatDateTime, formatMoney } from "@betng/ui-core";
import { Avatar, Badge, Button, Panel, SectionHeader, Tooltip } from "@betng/ui-web";
import { useAuth, useLogoutFlow } from "../features/auth";
import { useWallet } from "../hooks/queries";

const LINKS = [
  { to: "/history", label: "My bets", description: "Open and settled bets", icon: Receipt },
  { to: "/wallet", label: "Wallet", description: "Simulated balance, deposits and withdrawals", icon: Wallet },
  { to: "/notifications", label: "Notifications", description: "Match and settlement alerts", icon: Bell },
] as const;

export function AccountPage(): React.JSX.Element | null {
  const { user } = useAuth();
  const wallet = useWallet();
  const logout = useLogoutFlow();

  if (user === undefined) return null;

  return (
    <div className="max-w-2xl space-y-6">
      <SectionHeader as="h1" eyebrow="Your account" title="Account" />

      <Panel>
        <div className="flex items-center gap-4">
          <Avatar name={user.displayName} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold">{user.displayName}</p>
            <p className="truncate text-sm text-text-secondary">{user.email}</p>
          </div>
          <Badge tone={user.status === "ACTIVE" ? "success" : "warning"}>{user.status}</Badge>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-border pt-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="caps-label">Phone</dt>
            <dd className="mt-0.5 font-medium tabular">{user.phone ?? "Not provided"}</dd>
          </div>
          <div>
            <dt className="caps-label">Member since</dt>
            <dd className="mt-0.5 font-medium">{formatDateTime(user.createdAt)}</dd>
          </div>
          <div>
            <dt className="caps-label">Simulated balance</dt>
            <dd className="mt-0.5 font-medium tabular">{wallet.data === undefined ? "—" : formatMoney(wallet.data.available)}</dd>
          </div>
        </dl>
      </Panel>

      <Panel flush>
        <ul className="divide-y divide-border">
          {LINKS.map((item) => (
            <li key={item.to}>
              <Link to={item.to} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-hover focus-ring">
                <span className="flex size-8 items-center justify-center rounded-sm bg-surface-sunken text-text-secondary">
                  <item.icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-medium">{item.label}</span>
                  <span className="block truncate text-sm text-text-muted">{item.description}</span>
                </span>
                <ChevronRight className="size-4 text-text-muted" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Security">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <KeyRound className="mt-0.5 size-4 shrink-0 text-text-muted" aria-hidden />
            <div>
              <p className="text-base font-medium">Password</p>
              <p className="text-sm text-text-muted">Changing the password from here is not available until the platform serves it. Use “Forgot password” on the log-in screen to reset it by email.</p>
            </div>
          </div>
          <Tooltip content="Not served by the platform yet">
            <Button variant="secondary" size="sm" disabled>
              Change
            </Button>
          </Tooltip>
        </div>
        <p className="mt-4 border-t border-border pt-4 text-sm text-text-muted">
          Notification and theme preferences live in{" "}
          <Link to="/settings" className="font-semibold text-brand hover:underline">
            Settings
          </Link>
          .
        </p>
      </Panel>

      <Button variant="secondary" icon={<LogOut className="size-4" />} onClick={logout.request}>
        Log out
      </Button>
      {logout.dialog}
    </div>
  );
}
