/**
 * The RPC client for the wallet service.
 *
 * Betting never writes a balance: it asks the wallet to move money and the
 * wallet's ledger is the record. Every movement carries an idempotency key
 * derived from the bet or ticket, so a repeated call moves nothing twice.
 */

import { createRPCMetadata } from "@zudojs/rpc";
import type { RPCClient } from "@zudojs/rpc";
import { classifyPeerFailure } from "../errors/index.js";
import type { WalletMovement, WalletPeer } from "../interfaces/index.js";

export const WALLET_PROCEDURE = Object.freeze({
  DEBIT: "wallet.debit",
  CREDIT: "wallet.credit",
});

export function createWalletPeer(client: RPCClient): WalletPeer {
  async function move(
    procedure: string,
    movement: WalletMovement,
    requestId: string,
  ): Promise<void> {
    try {
      await client.call<WalletMovement, unknown>(procedure, movement, {
        metadata: createRPCMetadata({ requestId }),
      });
    } catch (error) {
      throw classifyPeerFailure("wallet", error);
    }
  }

  return {
    debit: async (movement, requestId) =>
      move(WALLET_PROCEDURE.DEBIT, movement, requestId),
    credit: async (movement, requestId) =>
      move(WALLET_PROCEDURE.CREDIT, movement, requestId),
  };
}
