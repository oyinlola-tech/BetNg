import type { ShopPermission, ShopSession } from "@betng/contracts";
import { hasPermission, type SessionStatus } from "@betng/ui-core";
import { useSession } from "@betng/ui-web";
import { shopSource } from "../services/dataSource";

export interface ShopSessionState {
  readonly status: SessionStatus;
  readonly session: ShopSession | undefined;
  readonly can: (permission: ShopPermission) => boolean;
}

export function useShopSession(): ShopSessionState {
  const { status, session } = useSession(shopSource.session);

  return { status, session, can: (permission) => hasPermission(session?.permissions, permission) };
}
