/**
 * The wallet application service.
 *
 * Resolves its dependencies from the ZudoJS container rather than taking
 * them as arguments, so a handler's collaborators are declared once, at
 * registration, and swapping the in-memory repository for the PostgreSQL
 * one is a change to the container and nothing else.
 *
 * SIMULATED FUNDS ONLY. Nothing registered here moves real money.
 */

import type { Container } from "@zudojs/container";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import {
  EVENT_BUS_TOKEN,
  WALLET_COMMAND,
  WALLET_QUERY,
  WALLET_REPOSITORY_TOKEN,
} from "../../constants/index.js";
import { DepositFundsHandler, WithdrawFundsHandler } from "./commands/index.js";
import { GetWalletHandler, ListTransactionsHandler } from "./queries/index.js";

/** What the wallet service registration needs. */
export interface WalletServiceConfig {
  /** The container the handlers' dependencies are resolved from. */
  readonly container: Container;
  /** The command bus to register write handlers on. */
  readonly commandBus: CommandBus;
  /** The query bus to register read handlers on. */
  readonly queryBus: QueryBus;
}

/**
 * Registers the wallet handlers with their buses.
 *
 * @param config - The container and the buses to register on.
 */
export function registerWalletService(config: WalletServiceConfig): void {
  const { container, commandBus, queryBus } = config;

  const wallets = container.resolve(WALLET_REPOSITORY_TOKEN);
  const events = container.resolve(EVENT_BUS_TOKEN);

  commandBus.register(
    WALLET_COMMAND.DEPOSIT_FUNDS,
    new DepositFundsHandler(wallets, events),
  );
  commandBus.register(
    WALLET_COMMAND.WITHDRAW_FUNDS,
    new WithdrawFundsHandler(wallets, events),
  );

  queryBus.register(WALLET_QUERY.GET_WALLET, new GetWalletHandler(wallets));
  queryBus.register(
    WALLET_QUERY.LIST_TRANSACTIONS,
    new ListTransactionsHandler(wallets),
  );
}
