/**
 * The peers betting reaches, all internal and all over RPC: risk and the
 * wallet on the placement path, identity for a cashier's PIN and the audit
 * trail. Prices are not fetched from a peer; they are read from the database.
 */

export { createRiskPeer, RISK_PROCEDURE } from "./risk.client.js";
export { createWalletPeer, WALLET_PROCEDURE } from "./wallet.client.js";
export { createIdentityPeer, IDENTITY_PROCEDURE } from "./identity.client.js";
export { createRedisMatchLock } from "./matchLock.client.js";
