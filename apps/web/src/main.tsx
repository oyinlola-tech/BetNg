import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router";
import { ErrorBoundary, FeatureFlagsProvider, LoggerProvider, ThemeProvider, ToastProvider, installGlobalLogging } from "@betng/ui-web";
import { createQueryClient } from "./lib/queryClient";
import { initRuntime, logger } from "./services/runtime";
import "./styles/app.css";

async function start(): Promise<void> {
  const container = document.getElementById("root");

  if (container === null) throw new Error("The #root element is missing from index.html.");

  installGlobalLogging(logger);

  const { flags } = await initRuntime();
  const { createAppRouter } = await import("./routes");
  const queryClient = createQueryClient();
  const router = createAppRouter();

  createRoot(container).render(
    <StrictMode>
      <LoggerProvider logger={logger}>
        <FeatureFlagsProvider flags={flags}>
          <ThemeProvider>
            <QueryClientProvider client={queryClient}>
              <ToastProvider>
                <ErrorBoundary
                  scope="global"
                  onError={(error, info) => {
                    logger.error("ui", "The application failed to render", {
                      error: error instanceof Error ? error.message : String(error),
                      componentStack: info.componentStack ?? "",
                    });
                  }}
                >
                  <RouterProvider router={router} />
                </ErrorBoundary>
              </ToastProvider>
            </QueryClientProvider>
          </ThemeProvider>
        </FeatureFlagsProvider>
      </LoggerProvider>
    </StrictMode>,
  );
}

start().catch((error: unknown) => {
  logger.error("flow", "The application could not start", { error: error instanceof Error ? error.message : String(error) });

  const status = document.getElementById("boot-status");

  if (status !== null) status.textContent = "BETNG could not start. Reload the page to try again.";
});
