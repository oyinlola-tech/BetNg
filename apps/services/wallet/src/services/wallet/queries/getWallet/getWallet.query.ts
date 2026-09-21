import { Query } from "@zudojs/cqrs";
import { WALLET_QUERY } from "../../../../constants/index.js";
import type { OwnerType } from "../../../../interfaces/index.js";

export class GetWalletQuery extends Query<"wallet.getWallet"> {
  public readonly ownerType: OwnerType;

  public readonly ownerId: string;

  public constructor(ownerType: OwnerType, ownerId: string) {
    super(WALLET_QUERY.GET_WALLET);
    this.ownerType = ownerType;
    this.ownerId = ownerId;
  }
}
