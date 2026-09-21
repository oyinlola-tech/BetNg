import { Suspense, useEffect, useState } from "react";
import { Outlet, ScrollRestoration, useLocation } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ConnectionStrip, ErrorBoundary, PageSkeleton, useFlag, useIsDesktop, useLogger, useOnline } from "@betng/ui-web";
import { AuthDialog } from "../features/auth";
import { BetSlipBar, BetSlipPanel } from "../features/betslip";
import { SearchDialog } from "../features/search";
import { useAccountSync } from "../hooks/shellQueries";
import { useConnection, useLastSyncedAt } from "../hooks/useConnection";
import { BottomNav } from "./shell/BottomNav";
import { Footer } from "./shell/Footer";
import { Header } from "./shell/Header";
import { LeagueBar } from "./shell/LeagueBar";
import { MoreSheet } from "./shell/MoreSheet";

function ConnectionStatus(): React.JSX.Element {
  const client = useQueryClient();
  const online = useOnline();
  const connection = useConnection();
  const lastSyncedAt = useLastSyncedAt();
  /* The realtime connection opens with the first subscription, so an idle CONNECTING is not a fault. */
  const state = !online ? "OFFLINE" : connection === "CONNECTING" ? "CONNECTED" : connection;

  return (
    <ConnectionStrip
      state={state}
      lastUpdatedAt={lastSyncedAt}
      staleAfterMs={120_000}
      onRetry={() => {
        void client.invalidateQueries();
      }}
    />
  );
}

export function AppShell(): React.JSX.Element {
  useAccountSync();

  const desktop = useIsDesktop();
  const location = useLocation();
  const logger = useLogger();
  const virtualsEnabled = useFlag("virtualFootballEnabled");
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-toast focus:rounded-sm focus:bg-brand focus:px-3 focus:py-2 focus:text-text-on-brand"
      >
        Skip to content
      </a>
      <Header />
      <LeagueBar />
      <ConnectionStatus />

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 items-start">
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 px-4 py-5 outline-none md:px-6 md:py-6 lg:px-8">
          <ErrorBoundary
            scope="route"
            resetKeys={[location.pathname]}
            onError={(error) => {
              logger.error("ui", "A page failed to render", { error: String(error), path: location.pathname });
            }}
          >
            <Suspense fallback={<PageSkeleton />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
        {desktop && virtualsEnabled && (
          <aside aria-label="Bet slip" className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-80 shrink-0 border-l border-border bg-surface xl:block">
            <ErrorBoundary scope="feature">
              <BetSlipPanel />
            </ErrorBoundary>
          </aside>
        )}
      </div>

      <Footer />

      {!desktop && virtualsEnabled && (
        <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-sticky lg:bottom-0">
          <ErrorBoundary scope="feature" fallback={null}>
            <BetSlipBar />
          </ErrorBoundary>
        </div>
      )}
      <BottomNav
        moreOpen={moreOpen}
        onMore={() => {
          setMoreOpen(true);
        }}
      />
      <MoreSheet
        open={moreOpen}
        onClose={() => {
          setMoreOpen(false);
        }}
      />

      <SearchDialog />
      <AuthDialog />
      <ScrollRestoration />
    </div>
  );
}
