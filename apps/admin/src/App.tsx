import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router";
import { DataSourceError } from "@betng/ui-core";
import { ThemeProvider, ToastProvider } from "@betng/ui-web";
import { useAdmin } from "./hooks/useAdmin";
import { LoginPage } from "./pages/LoginPage";
import { router } from "./routes";

const NO_RETRY = new Set(["FORBIDDEN", "UNAUTHENTICATED", "SESSION_EXPIRED", "NOT_FOUND", "VALIDATION"]);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2000,
      refetchOnWindowFocus: true,
      retry: (failures, error) => failures < 1 && !(error instanceof DataSourceError && NO_RETRY.has(error.code)),
    },
  },
});

function Gate(): React.JSX.Element {
  const { status } = useAdmin();

  // An expired session keeps the shell mounted so the operator returns to the same screen after signing in again.
  return status === "ANONYMOUS" ? <LoginPage /> : <RouterProvider router={router} />;
}

export function App(): React.JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <Gate />
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
