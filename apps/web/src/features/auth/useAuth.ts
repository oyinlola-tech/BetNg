import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { CustomerProfile } from "@betng/contracts";
import type { SessionStatus } from "@betng/ui-core";
import { useSession } from "@betng/ui-web";
import { clearPrivateQueries } from "../../lib/queryClient";
import { accountServices, authSource, logger, session } from "../../services/runtime";
import { releasePushOnSignOut } from "../push/webPush";
import {
  INTENT_REASONS,
  useAuthDialog,
  type AuthIntent,
  type AuthIntentName,
  type AuthView,
} from "./auth.store";

export interface UseAuth {
  readonly status: SessionStatus;
  readonly user: CustomerProfile | undefined;
  readonly isAuthenticated: boolean;
  /** Runs the intent now when signed in; otherwise asks for sign-in first and resumes it afterwards. Answers whether it ran. */
  readonly requireAuth: (
    intent: AuthIntentName | AuthIntent,
    run?: () => void,
  ) => boolean;
  readonly openAuth: (view: AuthView, intent?: AuthIntent) => void;
  readonly signOut: () => Promise<void>;
}

export function useIsAuthenticated(): boolean {
  return useSession(session).status === "AUTHENTICATED";
}

export function useAuth(): UseAuth {
  const snapshot = useSession(session);
  const show = useAuthDialog((s) => s.show);
  const client = useQueryClient();
  const isAuthenticated = snapshot.status === "AUTHENTICATED";

  const requireAuth = useCallback(
    (intent: AuthIntentName | AuthIntent, run?: () => void): boolean => {
      const resolved: AuthIntent =
        typeof intent === "string"
          ? { reason: INTENT_REASONS[intent], ...(run === undefined ? {} : { run }) }
          : run === undefined
            ? intent
            : { ...intent, run };
      const { status } = session.snapshot();

      if (status === "AUTHENTICATED") {
        resolved.run?.();

        return true;
      }

      show(status === "EXPIRED" ? "expired" : "login", resolved);

      return false;
    },
    [show],
  );

  const signOut = useCallback(async () => {
    await releasePushOnSignOut(() => accountServices.devices);

    try {
      await authSource.logout();
    } catch {
      logger.warn("auth", "Sign-out was not confirmed by the platform; the local session was cleared.");
    }

    if (session.snapshot().status !== "ANONYMOUS") session.clear();

    clearPrivateQueries(client);
  }, [client]);

  return {
    status: snapshot.status,
    user: isAuthenticated ? snapshot.session?.user : undefined,
    isAuthenticated,
    requireAuth,
    openAuth: show,
    signOut,
  };
}
