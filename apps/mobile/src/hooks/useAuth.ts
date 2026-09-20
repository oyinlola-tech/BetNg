import { useCallback, useSyncExternalStore } from "react";
import type { CustomerProfile } from "@betng/contracts";
import type { SessionStatus } from "@betng/ui-core";
import { navigationRef } from "../navigation/ref";
import type { AuthView } from "../navigation/types";
import { getAuthSource } from "../services/dataSource";
import { useAuthFlow, type AuthIntent } from "../stores/auth.store";

export interface UseAuth {
  readonly status: SessionStatus;
  readonly user: CustomerProfile | undefined;
  readonly isAuthenticated: boolean;
  /** Runs the intent now when signed in; otherwise opens sign-in and resumes it afterwards. */
  readonly requireAuth: (intent: AuthIntent) => void;
  readonly openAuth: (view: AuthView, intent?: AuthIntent) => void;
  readonly logout: () => Promise<void>;
}

export function openAuth(view: AuthView, intent?: AuthIntent): void {
  useAuthFlow.getState().setIntent(intent);
  if (navigationRef.isReady()) navigationRef.navigate("Auth", { view });
}

export function requireAuth(intent: AuthIntent): void {
  const status = getAuthSource().session.snapshot().status;

  if (status === "AUTHENTICATED") intent.run?.();
  else openAuth(status === "EXPIRED" ? "expired" : "login", intent);
}

export function useAuth(): UseAuth {
  const store = getAuthSource().session;
  const { status, session } = useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);
  const isAuthenticated = status === "AUTHENTICATED";
  const logout = useCallback(() => getAuthSource().logout(), []);

  return { status, user: isAuthenticated ? session?.user : undefined, isAuthenticated, requireAuth, openAuth, logout };
}
