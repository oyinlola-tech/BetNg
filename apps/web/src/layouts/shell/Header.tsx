import { Link, NavLink, useNavigate } from "react-router";
import { ArrowLeftRight, Bell, ChevronDown, LogOut, Receipt, Search, Settings, UserRound, Wallet } from "lucide-react";
import { formatMoney } from "@betng/ui-core";
import { Avatar, BrandLogo, Button, Dropdown, FeatureGate, IconButton, cn, useFeatureFlags, useFlag } from "@betng/ui-web";
import { useAuth } from "../../features/auth";
import { useSearchDialog } from "../../features/search";
import { useUnreadNotifications, useWalletSummary } from "../../hooks/shellQueries";
import { paths } from "../../lib/paths";
import { PRIMARY_NAV } from "./nav";
import { ThemeMenu } from "./ThemeMenu";

function NotificationsLink(): React.JSX.Element {
  const unread = useUnreadNotifications();

  return (
    <Link
      to={paths.notifications}
      aria-label={unread > 0 ? `Notifications, ${String(unread)} unread` : "Notifications"}
      className="relative inline-flex size-10 items-center justify-center rounded-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary focus-ring"
    >
      <Bell className="size-5" aria-hidden />
      {unread > 0 && (
        <span aria-hidden className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold tabular text-text-on-brand">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}

function WalletChip(): React.JSX.Element {
  const wallet = useWalletSummary(true);

  return (
    <Link
      to={paths.wallet}
      aria-label="Wallet"
      className="hidden h-9 items-center gap-2 rounded-sm border border-border bg-surface px-3 type-financial hover:bg-surface-hover focus-ring xl:inline-flex"
    >
      <Wallet className="size-4 text-text-muted" aria-hidden />
      {wallet.data === undefined ? <span className="text-text-muted">Wallet</span> : formatMoney(wallet.data.available)}
    </Link>
  );
}

function AccountControl(): React.JSX.Element {
  const navigate = useNavigate();
  const { status, user, requireAuth, signOut } = useAuth();
  const walletEnabled = useFlag("walletEnabled");

  if (status !== "AUTHENTICATED" || user === undefined) {
    return (
      <Button
        size="sm"
        className="ml-1"
        onClick={() => {
          requireAuth({ reason: "Sign in to BETNG" });
        }}
      >
        Sign in
      </Button>
    );
  }

  const go = (to: string) => () => {
    void navigate(to);
  };

  return (
    <Dropdown
      label="Account"
      className="ml-1"
      trigger={
        <span className="flex h-10 items-center gap-1.5 rounded-sm pl-1 pr-1.5 hover:bg-surface-hover">
          <Avatar name={user.displayName} />
          <ChevronDown className="size-3.5 text-text-muted" aria-hidden />
        </span>
      }
      items={[
        { key: "tickets", label: "My bets", icon: <Receipt />, onSelect: go(paths.tickets) },
        ...(walletEnabled
          ? [
              { key: "wallet", label: "Wallet", icon: <Wallet />, onSelect: go(paths.wallet) },
              { key: "transactions", label: "Transactions", icon: <ArrowLeftRight />, onSelect: go(paths.transactions) },
            ]
          : []),
        { key: "account", label: "Account", icon: <UserRound />, onSelect: go(paths.account) },
        { key: "settings", label: "Settings", icon: <Settings />, onSelect: go(paths.settings) },
        {
          key: "sign-out",
          label: "Sign out",
          icon: <LogOut />,
          tone: "danger" as const,
          onSelect: () => {
            void signOut();
          },
        },
      ]}
    />
  );
}

export function Header(): React.JSX.Element {
  const flags = useFeatureFlags();
  const { status } = useAuth();
  const showSearch = useSearchDialog((s) => s.show);

  return (
    <header className="sticky top-0 z-sticky border-b border-border bg-surface/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-2 px-4 md:px-6 lg:px-8">
        <Link to={paths.home} aria-label="BETNG home" className="flex items-center rounded-xs focus-ring">
          <BrandLogo />
        </Link>
        <nav aria-label="Primary" className="ml-6 hidden items-center gap-0.5 lg:flex">
          {PRIMARY_NAV.filter((item) => item.flag === undefined || flags[item.flag]).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "relative flex h-14 items-center px-3 text-base font-medium transition-colors focus-ring",
                  isActive
                    ? "text-text-primary after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-brand"
                    : "text-text-secondary hover:text-text-primary",
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-0.5">
          <FeatureGate flag="searchEnabled">
            <button
              type="button"
              onClick={showSearch}
              className="hidden h-9 w-48 items-center gap-2 rounded-sm border border-border bg-surface-sunken px-2.5 text-base text-text-muted hover:border-border-strong focus-ring lg:flex xl:w-60"
            >
              <Search className="size-4 shrink-0" aria-hidden />
              <span className="flex-1 text-left">Search</span>
              <kbd className="rounded-xs border border-border bg-surface px-1 text-xs font-medium text-text-muted">Ctrl K</kbd>
            </button>
            <IconButton label="Search" className="lg:hidden" onClick={showSearch}>
              <Search className="size-5" />
            </IconButton>
          </FeatureGate>
          <div className="hidden lg:block">
            <ThemeMenu />
          </div>
          <NotificationsLink />
          {status === "AUTHENTICATED" && flags.walletEnabled && <WalletChip />}
          <div className="hidden lg:block">
            <AccountControl />
          </div>
        </div>
      </div>
    </header>
  );
}
