import { createRpcClient } from "@betng/service-kit";
import type { ServiceEndpoint } from "@betng/service-kit";
import type { RealtimeRevoker } from "./sessionCacheEvictor.service.js";

const REVOKE_SESSIONS = "event.revokeSessions";
const TIMEOUT_MS = 2000;

export function createRealtimeRevoker(event: ServiceEndpoint): RealtimeRevoker & { close(): Promise<void> } {
  const client = createRpcClient(event, { timeoutMs: Math.min(TIMEOUT_MS, event.timeoutMs) });

  return {
    revoke: async (tokenHash) => {
      await client.call<{ tokenHash: string }, { revoked: number }>(REVOKE_SESSIONS, { tokenHash });
    },
    close: async () => {
      await client.close();
    },
  };
}
