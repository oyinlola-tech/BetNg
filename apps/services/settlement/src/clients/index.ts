/**
 * The RPC peers settlement reaches: betting (bet status), wallet (customer payouts and refunds) and identity
 * (audit). Addresses come from configuration; tests inject fakes of the same interfaces.
 */

export { BETTING_PROCEDURE, createBettingClient } from "./betting.client.js";
export type { BettingClient } from "./betting.client.js";

export { createWalletClient, WALLET_PROCEDURE } from "./wallet.client.js";
export type { WalletClient } from "./wallet.client.js";

export { createIdentityClient, IDENTITY_PROCEDURE } from "./identity.client.js";
export type { IdentityClient } from "./identity.client.js";

export { createAuditRecorder } from "./audit.recorder.js";
