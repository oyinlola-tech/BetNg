import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router";
import { LogOut, PanelLeftClose, PanelLeftOpen, Wallet } from "lucide-react";
import { createSessionMonitor, formatMoney } from "@betng/ui-core";
import { Avatar, BrandLogo, ConfirmDialog, ConnectionStrip, DevelopmentBanner, IconButton, SessionTimeoutWarning, ThemeSwitcher, Tooltip, cn, useFeatureFlags, useMediaQuery, useNow } from "@betng/ui-web";
import { Kbd } from "../components/Kbd";
import { SessionExpiredOverlay } from "../components/SessionExpiredOverlay";
import { useConnection } from "../hooks/useConnection";
import { useShopSync } from "../hooks/queries";
import { useShopSession } from "../hooks/useShopSession";
import { useShortcuts } from "../hooks/useShortcuts";
import { NAVIGATION } from "../lib/navigation";
import { LoginPage } from "../pages/LoginPage";
import { isMock, shopSource } from "../services/dataSource";
import { useSlip } from "../stores/slip.store";

const ROLE_LABEL = { OWNER: "Owner", MANAGER: "Manager", CASHIER: "Cashier" } as const;

function Clock(): React.JSX.Element {
  const now = useNow(1000);
  const date = new Date(now);

  return (
    <time dateTime={date.toISOString()} className="hidden text-right leading-tight md:block">
      <span className="block font-display text-md font-semibold tabular">{date.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}</span>
      <span className="block text-xs text-text-muted">{date.toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" })}</span>
    </time>
  );
}

export function TerminalShell(): React.JSX.Element {
  const { status, session, can } = useShopSession();
  const connection = useConnection();
  const navigate = useNavigate();
  const wide = useMediaQuery("(min-width: 1280px)");
  const [pinned, setPinned] = useState<boolean | undefined>();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const slipCount = useSlip((s) => s.selections.length);
  const clearSlip = useSlip((s) => s.clear);
  const expanded = pinned ?? wide;
  const flags = useFeatureFlags();
  const monitor = useMemo(() => createSessionMonitor(shopSource.session), []);

  useEffect(
    () => () => {
      monitor.dispose();
    },
    [monitor],
  );

  useShopSync();

  const groups = useMemo(
    () => NAVIGATION.map((group) => ({ ...group, items: group.items.filter((item) => (item.permission === undefined || can(item.permission)) && (item.flag === undefined || flags[item.flag])) })).filter((group) => group.items.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session?.permissions, flags],
  );

  const shortcuts = useMemo(() => {
    const entries = groups.flatMap((g) => g.items).filter((i) => i.shortcut !== undefined);

    return Object.fromEntries(entries.map((i) => [i.shortcut as string, () => void navigate(i.to)]));
  }, [groups, navigate]);

  useShortcuts(status === "AUTHENTICATED" ? shortcuts : {});

  if (status === "ANONYMOUS" || session === undefined)
    return (
      <>
        {isMock() && <DevelopmentBanner />}
        <LoginPage />
      </>
    );

  const logout = (): void => {
    clearSlip();
    setConfirmLogout(false);
    void shopSource.logout();
  };

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-toast focus:rounded-sm focus:bg-brand focus:px-3 focus:py-2 focus:text-text-on-brand">
        Skip to content
      </a>

      <nav aria-label="Terminal" className={cn("flex shrink-0 print:hidden flex-col border-r border-border bg-surface transition-[width] duration-[var(--bn-duration-base)]", expanded ? "w-56" : "w-14")}>
        <div className={cn("flex h-14 shrink-0 items-center border-b border-border", expanded ? "justify-between pl-4 pr-2" : "justify-center")}>
          {expanded && <BrandLogo size={24} product="Shop" />}
          <IconButton
            label={expanded ? "Collapse navigation" : "Expand navigation"}
            size="sm"
            aria-expanded={expanded}
            onClick={() => {
              setPinned(!expanded);
            }}
          >
            {expanded ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
          </IconButton>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto py-2 scrollbar-thin">
          {groups.map((group) => (
            <div key={group.label} className="mb-1.5">
              {expanded ? <p className="caps-label px-4 pb-1 pt-2">{group.label}</p> : <div className="mx-3 my-1.5 border-t border-border first:hidden" aria-hidden />}
              <ul>
                {group.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === "/"}
                      title={expanded ? undefined : item.label}
                      className={({ isActive }) =>
                        cn(
                          "relative mx-2 flex h-9 items-center gap-2.5 rounded-sm text-base font-medium transition-colors focus-ring pointer-coarse:h-11",
                          expanded ? "px-2.5" : "justify-center",
                          isActive ? "bg-brand-subtle text-brand" : "text-text-secondary hover:bg-surface-hover hover:text-text-primary",
                        )
                      }
                    >
                      <item.icon className="size-4 shrink-0" aria-hidden />
                      {expanded ? <span className="flex-1 truncate">{item.label}</span> : <span className="sr-only">{item.label}</span>}
                      {expanded && item.shortcut !== undefined && <Kbd>{item.shortcut}</Kbd>}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-border p-2">
          <button
            type="button"
            title={expanded ? undefined : "Logout"}
            onClick={() => {
              if (slipCount > 0) setConfirmLogout(true);
              else logout();
            }}
            className={cn("flex h-9 w-full items-center gap-2.5 rounded-sm text-base font-medium text-text-secondary transition-colors hover:bg-danger-subtle hover:text-danger focus-ring pointer-coarse:h-11", expanded ? "px-2.5" : "justify-center")}
          >
            <LogOut className="size-4 shrink-0" aria-hidden />
            {expanded ? "Logout" : <span className="sr-only">Logout</span>}
          </button>
        </div>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        {isMock() && (
          <div className="print:hidden">
            <DevelopmentBanner />
          </div>
        )}
        <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-surface px-4 print:hidden">
          <div className="min-w-0 leading-tight">
            <p className="truncate text-base font-semibold text-text-primary">{session.shop.name}</p>
            <p className="truncate font-mono text-xs text-text-muted">{session.shop.code}</p>
          </div>
          <div className="flex items-center gap-4">
            <Tooltip content="Cash float held for payouts (simulated)" side="bottom">
              <div className="flex items-center gap-2 rounded-sm bg-surface-sunken px-2.5 py-1.5" tabIndex={0}>
                <Wallet className="size-4 text-text-muted" aria-hidden />
                <div className="leading-tight">
                  <p className="text-[10px] font-semibold uppercase tracking-caps text-text-muted">Float</p>
                  <p className="font-display text-base font-semibold tabular">{formatMoney(session.shop.balance)}</p>
                </div>
              </div>
            </Tooltip>
            <Clock />
            <ThemeSwitcher className="hidden lg:inline-flex" />
            <div className="flex items-center gap-2 border-l border-border pl-4">
              <Avatar name={session.cashier.displayName} />
              <div className="hidden leading-tight sm:block">
                <p className="max-w-36 truncate text-sm font-semibold text-text-primary">{session.cashier.displayName}</p>
                <p className="text-xs text-text-muted">{ROLE_LABEL[session.cashier.role]}</p>
              </div>
            </div>
          </div>
        </header>
        <ConnectionStrip state={connection === "CONNECTING" ? "CONNECTED" : connection} />
        <main id="main" tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto outline-none scrollbar-thin">
          <Outlet />
        </main>
      </div>

      {status === "EXPIRED" ? <SessionExpiredOverlay session={session} /> : <SessionTimeoutWarning monitor={monitor} onSignOut={logout} />}

      <ConfirmDialog
        open={confirmLogout}
        onClose={() => {
          setConfirmLogout(false);
        }}
        onConfirm={logout}
        title="Sign out with a slip in progress?"
        description={`The slip has ${String(slipCount)} selection${slipCount === 1 ? "" : "s"} that have not been ticketed. Signing out discards them.`}
        confirmLabel="Discard and sign out"
        tone="danger"
      />
    </div>
  );
}
