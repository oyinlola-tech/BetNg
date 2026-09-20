import { Query } from "@zudojs/cqrs";
import { WALLET_QUERY } from "../../../../constants/index.js";

/** Asks for one user's simulated wallet. */
export class GetWalletQuery extends Query<"wallet.getWallet"> {
  public readonly userId: string;

  public constructor(userId: string) {
    super(WALLET_QUERY.GET_WALLET);
    this.userId = userId;
  }
}
