import { useEffect, useState } from "react";
import { createSessionMonitor, type SessionMonitor } from "@betng/ui-core";
import { SessionTimeoutWarning, useSession } from "@betng/ui-web";
import { accountServices, session } from "../../services/runtime";
import { useLogoutFlow } from "./useLogoutFlow";
import { usePrivateDataGuard } from "./usePrivateDataGuard";

/** Warns before the session runs out and drops private caches when it ends. Mounted once by the shell. */
export function SessionGuard(): React.JSX.Element | null {
  usePrivateDataGuard();

  const { status } = useSession(session);
  const logout = useLogoutFlow();
  const [monitor, setMonitor] = useState<SessionMonitor>();

  useEffect(() => {
    const created = createSessionMonitor(session, { refresh: () => accountServices.security.refreshSession() });

    setMonitor(created);

    return () => {
      created.dispose();
    };
  }, []);

  if (monitor === undefined || status !== "AUTHENTICATED") return logout.dialog;

  return (
    <>
      <SessionTimeoutWarning monitor={monitor} onSignOut={logout.request} />
      {logout.dialog}
    </>
  );
}
