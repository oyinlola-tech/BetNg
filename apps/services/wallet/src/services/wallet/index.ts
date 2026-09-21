import type { Container } from "@zudojs/container";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import {
  WALLET_COMMAND,
  WALLET_QUERY,
  WALLET_REPOSITORY_TOKEN,
} from "../../constants/index.js";
import {
  DepositFundsHandler,
  PostEntryHandler,
  WithdrawFundsHandler,
} from "./commands/index.js";
import {
  GetWalletHandler,
  GetWalletOverviewHandler,
  ListShopTransactionsHandler,
  ListTransactionsHandler,
  QueryTransactionsHandler,
} from "./queries/index.js";

export interface WalletServiceConfig {
  readonly container: Container;
  readonly commandBus: CommandBus;
  readonly queryBus: QueryBus;
}

export function registerWalletService(config: WalletServiceConfig): void {
  const { container, commandBus, queryBus } = config;

  const wallets = container.resolve(WALLET_REPOSITORY_TOKEN);

  commandBus.register(
    WALLET_COMMAND.DEPOSIT_FUNDS,
    new DepositFundsHandler(wallets),
  );
  commandBus.register(
    WALLET_COMMAND.WITHDRAW_FUNDS,
    new WithdrawFundsHandler(wallets),
  );
  commandBus.register(WALLET_COMMAND.POST_ENTRY, new PostEntryHandler(wallets));

  queryBus.register(WALLET_QUERY.GET_WALLET, new GetWalletHandler(wallets));
  queryBus.register(
    WALLET_QUERY.LIST_TRANSACTIONS,
    new ListTransactionsHandler(wallets),
  );
  queryBus.register(
    WALLET_QUERY.QUERY_TRANSACTIONS,
    new QueryTransactionsHandler(wallets),
  );
  queryBus.register(
    WALLET_QUERY.LIST_SHOP_TRANSACTIONS,
    new ListShopTransactionsHandler(wallets),
  );
  queryBus.register(
    WALLET_QUERY.GET_WALLET_OVERVIEW,
    new GetWalletOverviewHandler(wallets),
  );
}
