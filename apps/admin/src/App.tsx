import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router";
import { PowerOff } from "lucide-react";
import type { FeatureFlags } from "@betng/ui-core";
import { BrandLogo, EmptyState, ErrorBoundary, FeatureFlagsProvider, LoggerProvider, ThemeProvider, ToastProvider, useFlag } from "@betng/ui-web";
import { useAdmin } from "./hooks/useAdmin";
import { createQueryClient } from "./lib/queryClient";
import { LoginPage } from "./pages/LoginPage";
import { createAppRouter } from "./routes";
import { logger } from "./services/runtime";

function DisabledPage(): React.JSX.Element {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-4">
      <BrandLogo product="Admin" size={28} />
      <h1 className="sr-only">Administration is switched off</h1>
      <EmptyState icon={<PowerOff className="size-5" />} title="Administration is switched off" description="The platform has disabled the control plane for this environment. Nothing can be read or changed from here until it is enabled again." />
    </main>
  );
}

function Console(): React.JSX.Element {
  const [router] = useState(createAppRouter);

  return <RouterProvider router={router} />;
}

function Gate(): React.JSX.Element {
  const enabled = useFlag("adminEnabled");
  const { status } = useAdmin();

  if (!enabled) return <DisabledPage />;

  // An expired session keeps the console mounted, so the operator returns to the same screen after signing in again.
  return status === "ANONYMOUS" ? <LoginPage /> : <Console />;
}

export function App({ flags }: { readonly flags: FeatureFlags }): React.JSX.Element {
  const [queryClient] = useState(() => createQueryClient(logger));

  return (
    <LoggerProvider logger={logger}>
      <FeatureFlagsProvider flags={flags}>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <ToastProvider>
              <ErrorBoundary
                scope="global"
                onError={(error, info) => {
                  logger.error("ui", "Unhandled render error", { message: error instanceof Error ? error.message : "unknown", stack: info.componentStack ?? "" });
                }}
              >
                <Gate />
              </ErrorBoundary>
            </ToastProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </FeatureFlagsProvider>
    </LoggerProvider>
  );
}
