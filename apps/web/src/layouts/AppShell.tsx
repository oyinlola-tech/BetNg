import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { ArrowLeftRight, Bell, ChevronDown, LogOut, Menu, Receipt, Settings, UserRound, Wallet, X } from "lucide-react";
import { formatMoney } from "@betng/ui-core";
import { Avatar, BrandLogo, Button, cn, Dropdown, IconButton, Sheet, ThemeSwitcher, useIsDesktop } from "@betng/ui-web";
import { BetSlip, ConnectionBanner } from "../components/domain";
import { AuthDialog, useAuth, useLogoutFlow } from "../features/auth";
import { useAccountSync, useNotifications, useWallet } from "../hooks/queries";
import { useBetSlip } from "../stores/betslip.store";

const NAV = [
  { to: "/", label: "Home", end: true },
  { to: "/virtuals", label: "Virtual Football" },
  { to: "/live", label: "Live" },
  { to: "/results", label: "Results" },
  { to: "/leagues", label: "Leagues" },
  { to: "/standings", label: "Standings" },
] as const;

const ACCOUNT_NAV = [
  { to: "/history", label: "My Bets", icon: Receipt },
  { to: "/wallet", label: "Wallet", icon: Wallet },
  { to: "/history?tab=transactions", label: "Transactions", icon: ArrowLeftRight },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/account", label: "Account", icon: UserRound },
] as const;

function Logo(): React.JSX.Element {
  return (
    <Link to="/" className="flex items-center rounded-xs focus-ring" aria-label="BetNG home">
      <BrandLogo />
    </Link>
  );
}

export function AppShell(): React.JSX.Element {
  useAccountSync();

  const desktop = useIsDesktop();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user, openAuth } = useAuth();
  const logout = useLogoutFlow();
  const [menuOpen, setMenuOpen] = useState(false);
  const slipOpen = useBetSlip((s) => s.open);
  const setSlipOpen = useBetSlip((s) => s.setOpen);
  const selectionCount = useBetSlip((s) => s.selections.length);
  const wallet = useWallet();
  const notifications = useNotifications();
  const unread = notifications.data?.filter((n) => !n.read).length ?? 0;

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-toast focus:rounded-sm focus:bg-brand focus:px-3 focus:py-2 focus:text-text-on-brand"
      >
        Skip to content
      </a>
      <ConnectionBanner />
      <header className="sticky top-0 z-sticky border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-4 px-4 md:px-6">
          <IconButton
            label={menuOpen ? "Close menu" : "Open menu"}
            className="lg:hidden"
            onClick={() => {
              setMenuOpen((v) => !v);
            }}
          >
            {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </IconButton>
          <Logo />
          <nav
            aria-label="Primary"
            className="ml-4 hidden items-center gap-0.5 lg:flex"
          >
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={"end" in item}
                className={({ isActive }) =>
                  cn(
                    "rounded-sm px-3 py-1.5 text-sm font-medium transition-colors focus-ring",
                    isActive
                      ? "bg-surface-sunken text-text-primary"
                      : "text-text-secondary hover:text-text-primary",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            {isAuthenticated && (
              <>
                <Link
                  to="/wallet"
                  className="hidden h-9 items-center gap-2 rounded-sm border border-border bg-surface px-3 text-sm font-semibold tabular hover:bg-surface-hover focus-ring sm:inline-flex"
                >
                  <Wallet className="size-4 text-text-muted" aria-hidden />
                  {wallet.data === undefined ? "—" : formatMoney(wallet.data.available)}
                  <span className="hidden text-[10px] font-semibold uppercase tracking-caps text-text-muted md:inline">Simulated</span>
                </Link>
                <Link
                  to="/notifications"
                  className="relative inline-flex size-10 items-center justify-center rounded-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary focus-ring"
                  aria-label={`Notifications${unread > 0 ? `, ${String(unread)} unread` : ""}`}
                >
                  <Bell className="size-5" />
                  {unread > 0 && (
                    <span className="absolute right-2 top-2 flex size-4 items-center justify-center rounded-full bg-live text-[9px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>
                  )}
                </Link>
              </>
            )}
            <Link
              to="/settings"
              className="inline-flex size-10 items-center justify-center rounded-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary focus-ring"
              aria-label="Settings"
            >
              <Settings className="size-5" />
            </Link>
            <ThemeSwitcher className="hidden md:inline-flex" />
            {isAuthenticated && user !== undefined ? (
              <Dropdown
                label="Account menu"
                className="ml-1"
                trigger={
                  <span className="flex h-9 items-center gap-1.5 rounded-sm pl-0.5 pr-1.5 hover:bg-surface-hover">
                    <Avatar name={user.displayName} />
                    <span className="hidden max-w-28 truncate text-sm font-semibold lg:inline">{user.displayName.split(" ")[0]}</span>
                    <ChevronDown className="size-3.5 text-text-muted" aria-hidden />
                  </span>
                }
                items={[
                  ...ACCOUNT_NAV.map((item) => ({
                    key: item.to,
                    label: item.label,
                    icon: <item.icon />,
                    onSelect: () => {
                      void navigate(item.to);
                    },
                  })),
                  { key: "logout", label: "Log out", icon: <LogOut />, tone: "danger" as const, onSelect: logout.request },
                ]}
              />
            ) : (
              <div className="ml-1 hidden items-center gap-1.5 sm:flex">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    openAuth("login");
                  }}
                >
                  Log in
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    openAuth("register");
                  }}
                >
                  Register
                </Button>
              </div>
            )}
            {!desktop && (
              <button
                type="button"
                onClick={() => {
                  setSlipOpen(true);
                }}
                className="relative ml-1 inline-flex h-9 items-center gap-1.5 rounded-sm bg-brand px-3 text-sm font-semibold text-text-on-brand focus-ring"
              >
                <Receipt className="size-4" aria-hidden />
                Slip
                {selectionCount > 0 && (
                  <span className="rounded-xs bg-white/20 px-1.5 text-xs tabular">
                    {selectionCount}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
        {menuOpen && (
          <nav
            aria-label="Primary"
            className="border-t border-border bg-surface px-4 py-2 lg:hidden animate-fade-in"
          >
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={"end" in item}
                className={({ isActive }) =>
                  cn(
                    "block rounded-sm px-3 py-2.5 text-md font-medium focus-ring",
                    isActive
                      ? "bg-surface-sunken text-text-primary"
                      : "text-text-secondary",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
            <div className="mt-2 border-t border-border pt-2">
              {isAuthenticated ? (
                <>
                  {ACCOUNT_NAV.map((item) => (
                    <Link key={item.to} to={item.to} className="flex items-center gap-3 rounded-sm px-3 py-2.5 text-md font-medium text-text-secondary focus-ring">
                      <item.icon className="size-4 text-text-muted" aria-hidden />
                      {item.label}
                      {item.to === "/wallet" && wallet.data !== undefined && <span className="ml-auto text-sm font-semibold tabular text-text-primary">{formatMoney(wallet.data.available)}</span>}
                    </Link>
                  ))}
                  <button type="button" onClick={logout.request} className="flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-md font-medium text-danger focus-ring">
                    <LogOut className="size-4" aria-hidden />
                    Log out
                  </button>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-2 px-3 py-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setMenuOpen(false);
                      openAuth("login");
                    }}
                  >
                    Log in
                  </Button>
                  <Button
                    onClick={() => {
                      setMenuOpen(false);
                      openAuth("register");
                    }}
                  >
                    Register
                  </Button>
                </div>
              )}
              <div className="flex items-center justify-between px-3 py-3 md:hidden">
                <span className="text-sm text-text-muted">Theme</span>
                <ThemeSwitcher />
              </div>
            </div>
          </nav>
        )}
      </header>

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 items-start">
        <main id="main" className="min-w-0 flex-1 px-4 py-5 md:px-6 md:py-6">
          <Outlet />
        </main>
        {desktop && (
          <aside
            className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-80 shrink-0 border-l border-border bg-surface xl:block"
            aria-label="Bet slip"
          >
            <BetSlip />
          </aside>
        )}
      </div>

      {!desktop && (
        <Sheet
          open={slipOpen}
          onClose={() => {
            setSlipOpen(false);
          }}
          title="Bet slip"
          side="bottom"
        >
          <BetSlip
            onPlaced={() => {
              setSlipOpen(false);
            }}
          />
        </Sheet>
      )}

      <AuthDialog />
      {logout.dialog}

      <footer className="border-t border-border px-4 py-4 text-center text-xs text-text-muted">
        BetNG is a portfolio simulation. Balances, stakes and returns are
        play-money and carry no real-world value.
      </footer>
    </div>
  );
}
