import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, ChevronsLeft, ChevronsRight, LogOut, Menu, Search, X } from "lucide-react";
import { Avatar, BrandLogo, ConnectionStrip, Dropdown, IconButton, StatusBadge, ThemeSwitcher, cn, useMediaQuery } from "@betng/ui-web";
import { LoginForm } from "../components/LoginForm";
import { useAdminSync } from "../hooks/queries";
import { useAdmin, useConnection } from "../hooks/useAdmin";
import { useLastUpdated } from "../hooks/useLastUpdated";
import { NAV, ROLE_LABELS, crumbsFor, type NavGroup } from "../lib/navigation";
import { keys } from "../lib/queryKeys";
import { adminSource, env } from "../services/runtime";
import { CommandPalette } from "./CommandPalette";

const COLLAPSE_KEY = "betng.admin.sidebar";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
  } catch {
    return;
  }
}

function Sidebar({ groups, collapsed, onNavigate }: { readonly groups: readonly NavGroup[]; readonly collapsed: boolean; readonly onNavigate?: () => void }): React.JSX.Element {
  const nav = useRef<HTMLElement>(null);
  const { pathname } = useLocation();

  useEffect(() => {
    const current = nav.current?.querySelector('[aria-current="page"]');

    if (current !== null && current !== undefined && typeof current.scrollIntoView === "function") current.scrollIntoView({ block: "nearest" });
  }, [pathname]);

  return (
    <nav ref={nav} aria-label="Primary" className="flex-1 overflow-y-auto px-2 py-3 scrollbar-thin">
      {groups.map((group) => (
        <div key={group.label} className="mb-3">
          {collapsed ? <div className="mx-2 mb-2 border-t border-border" aria-hidden /> : <p className="caps-label mb-1 px-2.5 text-[10px]">{group.label}</p>}
          <ul className="space-y-px">
            {group.items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === "/"}
                  {...(onNavigate === undefined ? {} : { onClick: onNavigate })}
                  aria-label={collapsed ? item.label : undefined}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    cn(
                      "relative flex h-8 items-center gap-2.5 rounded-sm px-2.5 text-base font-medium transition-colors focus-ring pointer-coarse:h-11",
                      collapsed && "justify-center px-0",
                      isActive ? "bg-brand-subtle text-text-primary before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-brand" : "text-text-secondary hover:bg-surface-hover hover:text-text-primary",
                    )
                  }
                >
                  <item.icon className="size-4 shrink-0" aria-hidden />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function NavDrawer({ open, onClose, groups }: { readonly open: boolean; readonly onClose: () => void; readonly groups: readonly NavGroup[] }): React.JSX.Element | null {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;

    if (dialog === null) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={ref}
      aria-label="Navigation"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className="fixed inset-y-0 left-0 right-auto m-0 flex h-dvh max-h-none w-72 max-w-[85vw] flex-col border-r border-border bg-surface p-0 text-text-primary shadow-lg backdrop:bg-overlay"
    >
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
        <BrandLogo product="Admin" size={24} />
        <IconButton label="Close navigation" size="sm" onClick={onClose}>
          <X className="size-4" aria-hidden />
        </IconButton>
      </div>
      <Sidebar groups={groups} collapsed={false} onNavigate={onClose} />
      <div className="border-t border-border p-3">
        <ThemeSwitcher showLabels />
      </div>
    </dialog>
  );
}

function Breadcrumbs(): React.JSX.Element {
  const { pathname } = useLocation();
  const crumbs = crumbsFor(pathname);

  return (
    <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
      <ol className="flex min-w-0 items-center gap-1 text-sm">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;

          return (
            <Fragment key={`${crumb.label}-${String(index)}`}>
              {index > 0 && (
                <li aria-hidden className="text-text-muted">
                  <ChevronRight className="size-3.5" />
                </li>
              )}
              <li className={cn(last ? "min-w-0 truncate" : "shrink-0", index === 0 && crumbs.length > 1 && "hidden md:block")}>
                {crumb.to !== undefined ? (
                  <Link to={crumb.to} className="rounded-xs text-text-secondary hover:text-text-primary hover:underline focus-ring">
                    {crumb.label}
                  </Link>
                ) : (
                  <span aria-current={last ? "page" : undefined} className={last ? "font-semibold text-text-primary" : "text-text-muted"}>
                    {crumb.label}
                  </span>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

function SessionExpiredOverlay({ email }: { readonly email: string | undefined }): React.JSX.Element {
  const client = useQueryClient();

  return (
    <div role="dialog" aria-modal aria-labelledby="expired-title" className="fixed inset-0 z-modal flex items-center justify-center bg-overlay p-4 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface-elevated p-6 shadow-lg">
        <h2 id="expired-title" className="type-h3">
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

  const { admin, status } = useAdmin();
  const connection = useConnection();
  const lastUpdatedAt = useLastUpdated();
  const client = useQueryClient();
  const location = useLocation();
  const wide = useMediaQuery("(min-width: 1024px)");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const granted = admin?.permissions;

  const groups = useMemo(
    () => NAV.map((group) => ({ ...group, items: group.items.filter((item) => item.permission === undefined || granted?.includes(item.permission) === true) })).filter((group) => group.items.length > 0),
    [granted],
  );

  useEffect(() => {
    setDrawerOpen(false);
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

  const signOut = (): void => {
    client.clear();
    void adminSource.logout();
  };

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-toast focus:rounded-sm focus:bg-brand focus:px-3 focus:py-2 focus:text-text-on-brand">
        Skip to content
      </a>

      {wide && (
        <aside className={cn("flex shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-[var(--bn-duration-base)]", collapsed ? "w-14" : "w-56")}>
          <div className={cn("flex h-14 shrink-0 items-center border-b border-border", collapsed ? "justify-center" : "px-4")}>
            <BrandLogo product="Admin" size={24} markOnly={collapsed} />
          </div>
          <Sidebar groups={groups} collapsed={collapsed} />
          <div className={cn("flex border-t border-border p-2", collapsed ? "justify-center" : "justify-end")}>
            <IconButton
              label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              size="sm"
              onClick={() => {
                writeCollapsed(!collapsed);
                setCollapsed(!collapsed);
              }}
            >
              {collapsed ? <ChevronsRight className="size-4" aria-hidden /> : <ChevronsLeft className="size-4" aria-hidden />}
            </IconButton>
          </div>
        </aside>
      )}

      {!wide && <NavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} groups={groups} />}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-4 lg:px-6">
          {!wide && (
            <IconButton label="Open navigation" size="sm" onClick={() => setDrawerOpen(true)}>
              <Menu className="size-4" aria-hidden />
            </IconButton>
          )}
          <Breadcrumbs />
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              aria-label="Jump to a screen"
              onClick={() => setPaletteOpen(true)}
              className="flex h-8 items-center gap-2 rounded-sm border border-border bg-surface-sunken px-2.5 text-sm text-text-muted transition-colors hover:border-border-strong focus-ring md:w-40 xl:w-52"
            >
              <Search className="size-3.5 shrink-0" aria-hidden />
              <span className="hidden truncate md:block">Jump to</span>
              <kbd className="ml-auto hidden rounded-xs border border-border px-1 font-mono text-[10px] md:block">Ctrl K</kbd>
            </button>
            {env.dataSource === "mock" && <span className="hidden rounded-xs border border-border-strong px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-caps text-text-secondary xl:block">Mock data</span>}
            <StatusBadge status={connection === "CONNECTED" ? "ONLINE" : connection === "OFFLINE" || connection === "FAILED" ? "OFFLINE" : "PENDING"} className="hidden xl:inline-flex">
              {connection === "CONNECTED" ? "Realtime connected" : connection === "OFFLINE" ? "Offline" : connection === "FAILED" ? "Realtime unavailable" : "Connecting"}
            </StatusBadge>
            <ThemeSwitcher className="hidden lg:inline-flex" />
            {admin !== undefined && (
              <Dropdown
                label="Account menu"
                trigger={
                  <span className="flex items-center gap-2 rounded-sm py-1 pl-1 pr-2 hover:bg-surface-hover">
                    <Avatar name={admin.displayName} size="sm" />
                    <span className="hidden text-left leading-tight sm:block">
                      <span className="block max-w-36 truncate text-sm font-semibold text-text-primary">{admin.displayName}</span>
                      <span className="block text-[10px] uppercase tracking-caps text-text-muted">{ROLE_LABELS[admin.role] ?? admin.role}</span>
                    </span>
                  </span>
                }
                items={[{ key: "logout", label: "Sign out", icon: <LogOut />, onSelect: signOut }]}
              />
            )}
          </div>
        </header>
        <ConnectionStrip
          state={connection}
          lastUpdatedAt={lastUpdatedAt}
          staleAfterMs={120_000}
          onRetry={() => {
            void client.invalidateQueries({ refetchType: "active" });
          }}
        />
        <main id="main" tabIndex={-1} className="relative min-h-0 flex-1 overflow-y-auto outline-none [scrollbar-gutter:stable] scrollbar-thin">
          <div className="mx-auto w-full max-w-[1600px] px-4 py-5 md:px-6 xl:px-8">
            <Outlet />
          </div>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} items={groups.flatMap((g) => g.items)} />
      {status === "EXPIRED" && <SessionExpiredOverlay email={admin?.email} />}
    </div>
  );
}
