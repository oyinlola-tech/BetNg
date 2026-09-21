import type { BetNgAdminClient, BetNgComplianceClient } from "@betng/client-sdk";
import type { AdminLoginRequest, AdminSession } from "@betng/contracts";
import type { SessionStore } from "./session.js";

export interface AdminDataSource extends Omit<BetNgAdminClient, "login" | "logout" | "session"> {
  readonly session: SessionStore<AdminSession>;
  login(request: AdminLoginRequest): Promise<AdminSession>;
  logout(): Promise<void>;
  subscribe(listener: () => void): () => void;
}

/** Pending backend: KYC review, payment monitoring and responsible-gaming oversight. */
export type ComplianceDataSource = BetNgComplianceClient;
