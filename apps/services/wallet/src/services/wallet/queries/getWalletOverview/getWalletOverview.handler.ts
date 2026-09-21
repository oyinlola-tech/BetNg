import { QueryHandler } from "@zudojs/cqrs";
import { WALLET_QUERY } from "../../../../constants/index.js";
import type {
  OverviewRecord,
  WalletRepository,
} from "../../../../interfaces/index.js";
import type { GetWalletOverviewQuery } from "./getWalletOverview.query.js";

export class GetWalletOverviewHandler extends QueryHandler<
  GetWalletOverviewQuery,
  OverviewRecord
> {
  public readonly queryType = WALLET_QUERY.GET_WALLET_OVERVIEW;

  private readonly wallets: WalletRepository;

  public constructor(wallets: WalletRepository) {
    super();
    this.wallets = wallets;
  }

  public async execute(query: GetWalletOverviewQuery): Promise<OverviewRecord> {
    return this.wallets.getOverview(query.today, query.limit);
  }
}
