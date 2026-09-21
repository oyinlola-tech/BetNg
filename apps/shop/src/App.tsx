import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router";
import { ErrorBoundary, FeatureFlagsProvider, LoggerProvider, ThemeProvider, ToastProvider } from "@betng/ui-web";
import { router } from "./routes";
import { getRuntimeInfo } from "./services/runtime";
import { logger } from "./services/logger";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 2000, refetchOnWindowFocus: true },
  },
});

export function App(): React.JSX.Element {
  return (
    <LoggerProvider logger={logger}>
      <FeatureFlagsProvider flags={getRuntimeInfo().flags}>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <ToastProvider>
              <ErrorBoundary
                scope="global"
                onError={(error) => {
                  logger.error("ui", "Unhandled render error", { message: error instanceof Error ? error.message : "unknown" });
                }}
              >
                <RouterProvider router={router} />
              </ErrorBoundary>
            </ToastProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </FeatureFlagsProvider>
    </LoggerProvider>
  );
}
