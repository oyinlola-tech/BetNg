import { createRpcClient } from "@betng/service-kit";
import type { ServiceEndpoint } from "@betng/service-kit";
import { createRPCMetadata } from "@zudojs/rpc";
import type { RPCClient } from "@zudojs/rpc";
import type { WalletCreditRequest, WalletPeer } from "../interfaces/index.js";

export const WALLET_PROCEDURE = Object.freeze({
  CREDIT: "wallet.credit",
});

export interface WalletClient extends WalletPeer {
  readonly raw: RPCClient;
}

/** Credit only, customer only: there is deliberately no debit and no other owner type. */
export function createWalletClient(endpoint: ServiceEndpoint): WalletClient {
  const client = createRpcClient(endpoint);

  return {
    raw: client,
    credit: async (request, requestId) => {
      const result = await client.call<WalletCreditRequest, { readonly duplicate?: boolean }>(
        WALLET_PROCEDURE.CREDIT,
        request,
        { metadata: createRPCMetadata({ requestId }) },
      );

      return { duplicate: result.duplicate === true };
    },
  };
}
