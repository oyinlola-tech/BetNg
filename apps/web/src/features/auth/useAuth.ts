import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { CustomerProfile } from "@betng/contracts";
import type { SessionStatus } from "@betng/ui-core";
import { useSession } from "@betng/ui-web";
import { ACCOUNT_QUERY_KEYS } from "../../lib/queryKeys";
import { authSource } from "../../services/dataSource";
import { useAuthDialog, type AuthIntent, type AuthView } from "./auth.store";

export interface UseAuth {
  readonly status: SessionStatus;
  readonly user: CustomerProfile | undefined;
  readonly isAuthenticated: boolean;
  /** Runs the intent now when signed in; otherwise asks for sign-in first and resumes it afterwards. */
  readonly requireAuth: (intent: AuthIntent) => void;
  readonly openAuth: (view: AuthView, intent?: AuthIntent) => void;
  readonly logout: () => Promise<void>;
}

export function useIsAuthenticated(): boolean {
  return useSession(authSource.session).status === "AUTHENTICATED";
}

export function useAuth(): UseAuth {
  const { status, session } = useSession(authSource.session);
  const show = useAuthDialog((s) => s.show);
  const client = useQueryClient();
  const isAuthenticated = status === "AUTHENTICATED";

  const requireAuth = useCallback(
    (intent: AuthIntent) => {
      if (authSource.session.snapshot().status === "AUTHENTICATED") intent.run?.();
      else show(authSource.session.snapshot().status === "EXPIRED" ? "expired" : "login", intent);
    },
    [show],
  );

  const logout = useCallback(async () => {
    await authSource.logout();

    for (const queryKey of ACCOUNT_QUERY_KEYS) client.removeQueries({ queryKey });
  }, [client]);

  return { status, user: isAuthenticated ? session?.user : undefined, isAuthenticated, requireAuth, openAuth: show, logout };
}
