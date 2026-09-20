import { useSyncExternalStore } from "react";
import type { AdminPermission, AdminUser } from "@betng/contracts";
import { hasPermission, type ConnectionState, type SessionStatus } from "@betng/ui-core";
import { useSession } from "@betng/ui-web";
import { adminSource, dataSource } from "../services/sources";

export interface AdminContext {
  readonly status: SessionStatus;
  readonly admin: AdminUser | undefined;
  /** Decides what to render only. The platform enforces every permission again on the request. */
  readonly can: (permission: AdminPermission) => boolean;
}

export function useAdmin(): AdminContext {
  const { status, session } = useSession(adminSource.session);
  const admin = session?.admin;

  return { status, admin, can: (permission) => hasPermission(admin?.permissions, permission) };
}

export function useConnection(): ConnectionState {
  return useSyncExternalStore(
    (onChange) => dataSource.subscribeConnection(onChange),
    () => dataSource.getConnectionState(),
    () => "CONNECTING" as const,
  );
}
