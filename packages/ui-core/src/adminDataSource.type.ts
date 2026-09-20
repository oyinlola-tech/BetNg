import type { BetNgAdminClient } from "@betng/client-sdk";
import type { AdminLoginRequest, AdminSession } from "@betng/contracts";
import type { SessionStore } from "./session.js";

/** The control plane's view of the platform: every read and operation the admin SDK exposes, plus the session. */
export interface AdminDataSource extends Omit<BetNgAdminClient, "login" | "logout" | "session"> {
  readonly session: SessionStore<AdminSession>;
  login(request: AdminLoginRequest): Promise<AdminSession>;
  logout(): Promise<void>;
  /** Fires when operational state changes underneath the screens (mock: the virtual season advancing). */
  subscribe(listener: () => void): () => void;
}
