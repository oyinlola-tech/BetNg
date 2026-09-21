import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronsLeft, ChevronsRight, LogOut, Menu, Search, X } from "lucide-react";
import { Avatar, BrandLogo, ConnectionStrip, Dropdown, IconButton, StatusBadge, ThemeSwitcher, cn, useMediaQuery } from "@betng/ui-web";
import { LoginForm } from "../components/LoginForm";
import { appConfig } from "../configs/app.config";
import { useAdminSync } from "../hooks/queries";
import { useAdmin, useConnection } from "../hooks/useAdmin";
import { keys } from "../lib/queryKeys";
import { NAV, ROLE_LABELS, type NavGroup } from "../lib/permissions";
import { adminSource } from "../services/sources";
import { CommandPalette } from "./CommandPalette";

const COLLAPSE_KEY = "betng.admin.sidebar";

function Sidebar({ groups, collapsed, onNavigate }: { readonly groups: readonly NavGroup[]; readonly collapsed: boolean; readonly onNavigate?: () => void }): React.JSX.Element {
  const nav = useRef<HTMLElement>(null);
  const { pathname } = useLocation();

  // On short screens the list scrolls, so the current screen is kept in view.
  useEffect(() => {
    nav.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest" });
  }, [pathname]);

  return (
    <nav ref={nav} aria-label="Primary" className="flex-1 overflow-y-auto px-2 py-2 scrollbar-thin">
      {groups.map((group) => (
        <div key={group.label} className="mb-2">
          {collapsed ? <div className="mx-2 mb-2 border-t border-border" aria-hidden /> : <p className="caps-label mb-0.5 px-2.5 text-[10px]">{group.label}</p>}
          <ul className="space-y-px">
            {group.items.map((item) => {
              const link = (
                <NavLink
                  to={item.to}
                  end={item.to === "/"}
                  {...(onNavigate === undefined ? {} : { onClick: onNavigate })}
                  aria-label={collapsed ? item.label : undefined}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    cn(
                      "group relative flex h-7 items-center gap-2.5 rounded-sm px-2.5 text-base font-medium transition-colors focus-ring",
                      collapsed && "justify-center px-0",
                      isActive ? "bg-brand-subtle text-text-primary before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-brand" : "text-text-secondary hover:bg-surface-hover hover:text-text-primary",
                    )
                  }
                >
                  <item.icon className="size-4 shrink-0" aria-hidden />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              );

              return <li key={item.to}>{link}</li>;
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SessionExpiredOverlay({ email }: { readonly email: string | undefined }): React.JSX.Element {
  const client = useQueryClient();

  return (
    <div role="dialog" aria-modal aria-labelledby="expired-title" className="fixed inset-0 z-modal flex items-center justify-center bg-overlay p-4 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface-elevated p-6 shadow-lg">
        <h2 id="expired-title" className="font-display text-lg font-bold">
          Your session has ended
        </h2>
        <p className="mb-5 mt-1 text-sm text-text-muted">Sign in again to continue where you were. Nothing unsaved has been submitted.</p>
        <LoginForm
          lockedEmail={email}
          onSignedIn={() => {
            void client.invalidateQueries({ queryKey: keys.root });
          }}
        />
        <button
          type="button"
          onClick={() => {
            client.clear();
            void adminSource.logout();
          }}
          className="mt-4 w-full rounded-xs text-center text-sm text-text-muted hover:text-text-primary focus-ring"
        >
          Sign in as someone else
        </button>
      </div>
    </div>
  );
}

export function AdminShell(): React.JSX.Element {
  useAdminSync();

  const { admin, status, can } = useAdmin();
  const connection = useConnection();
  const client = useQueryClient();
  const location = useLocation();
  const wide = useMediaQuery("(min-width: 1024px)");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });

  const groups = useMemo(
    () => NAV.map((group) => ({ ...group, items: group.items.filter((item) => item.permission === undefined || can(item.permission)) })).filter((group) => group.items.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [admin?.permissions],
  );

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };

    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const toggleCollapsed = (): void => {
    setCollapsed((value) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, value ? "0" : "1");
      } catch {
        /* ignore */
      }

      return !value;
    });
  };

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-toast focus:rounded-sm focus:bg-brand focus:px-3 focus:py-2 focus:text-text-on-brand">
        Skip to content
      </a>

      {wide && (
        <aside className={cn("flex shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-[var(--bn-duration-base)]", collapsed ? "w-14" : "w-56")}>
          <div className={cn("flex h-12 shrink-0 items-center border-b border-border", collapsed ? "justify-center" : "px-4")}>
            <BrandLogo product="Admin" size={24} markOnly={collapsed} />
          </div>
          <Sidebar groups={groups} collapsed={collapsed} />
          <div className={cn("flex border-t border-border p-2", collapsed ? "justify-center" : "justify-end")}>
            <IconButton label={collapsed ? "Expand sidebar" : "Collapse sidebar"} size="sm" onClick={toggleCollapsed}>
              {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
            </IconButton>
          </div>
        </aside>
      )}

      {!wide && mobileOpen && (
        <div className="fixed inset-0 z-drawer flex">
          <button type="button" aria-label="Close navigation" className="absolute inset-0 bg-overlay" onClick={() => setMobileOpen(false)} />
          <aside className="relative flex w-64 max-w-[85vw] flex-col border-r border-border bg-surface shadow-lg">
            <div className="flex h-12 items-center justify-between border-b border-border px-4">
              <BrandLogo product="Admin" size={24} />
              <IconButton label="Close navigation" size="sm" onClick={() => setMobileOpen(false)}>
                <X className="size-4" />
              </IconButton>
            </div>
            <Sidebar groups={groups} collapsed={false} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-surface px-3 sm:px-4">
          {!wide && (
            <IconButton label="Open navigation" size="sm" onClick={() => setMobileOpen(true)}>
              <Menu className="size-4" />
            </IconButton>
          )}
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-sm border border-border bg-surface-sunken px-2.5 text-sm text-text-muted transition-colors hover:border-border-strong focus-ring sm:max-w-xs"
          >
            <Search className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">Jump to…</span>
            <kbd className="ml-auto hidden rounded-xs border border-border px-1 font-mono text-[10px] sm:block">Ctrl K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-3">
            <span className={cn("hidden rounded-xs border px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-caps md:block", appConfig.dataSource === "mock" ? "border-warning/50 text-warning" : "border-success/50 text-success")}>
              {appConfig.dataSource === "mock" ? "Mock data" : "Platform"}
            </span>
            <StatusBadge tone={connection === "CONNECTED" ? "success" : connection === "OFFLINE" ? "danger" : "warning"} pulse={connection !== "CONNECTED" && connection !== "OFFLINE"} className="hidden sm:inline-flex">
              {connection === "CONNECTED" ? "Live feed" : connection === "OFFLINE" ? "Offline" : "Reconnecting"}
            </StatusBadge>
            <ThemeSwitcher className="hidden md:inline-flex" />
            {admin !== undefined && (
              <Dropdown
                label="Account menu"
                trigger={
                  <span className="flex items-center gap-2 rounded-sm py-1 pl-1 pr-2 hover:bg-surface-hover">
                    <Avatar name={admin.displayName} size="sm" />
                    <span className="hidden text-left leading-tight sm:block">
                      <span className="block text-sm font-semibold text-text-primary">{admin.displayName}</span>
                      <span className="block text-[10px] uppercase tracking-caps text-text-muted">{ROLE_LABELS[admin.role] ?? admin.role}</span>
                    </span>
                  </span>
                }
                items={[
                  {
                    key: "logout",
                    label: "Sign out",
                    icon: <LogOut />,
                    onSelect: () => {
                      client.clear();
                      void adminSource.logout();
                    },
                  },
                ]}
              />
            )}
          </div>
        </header>
        <ConnectionStrip state={connection} />
        <main id="main" tabIndex={-1} className="relative min-h-0 flex-1 overflow-y-auto outline-none [scrollbar-gutter:stable] scrollbar-thin">
          <div className="mx-auto w-full max-w-[1600px] px-3 py-4 sm:px-5 sm:py-5">
            <Outlet />
          </div>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} items={groups.flatMap((g) => g.items)} />
      {status === "EXPIRED" && <SessionExpiredOverlay email={admin?.email} />}
    </div>
  );
}
