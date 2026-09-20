/**
 * Wallet HTTP handlers.
 *
 * SIMULATED FUNDS ONLY. Every endpoint here moves a number in a store; no
 * payment provider is involved.
 */

import { parseBody, requireParam } from "@betng/service-kit";
import type { HttpRouterContext } from "@betng/service-kit";
import type { Transaction, Wallet } from "@betng/contracts";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import type { LedgerEntryDto, TransactionListDto } from "../dtos/index.js";
import type { LedgerResult } from "../interfaces/index.js";
import {
  DepositFundsCommand,
  WithdrawFundsCommand,
} from "../services/wallet/commands/index.js";
import {
  GetWalletQuery,
  ListTransactionsQuery,
} from "../services/wallet/queries/index.js";
import { depositValidator, withdrawValidator } from "../validators/index.js";

export interface WalletController {
  getWallet(context: HttpRouterContext): Promise<Wallet>;
  listTransactions(context: HttpRouterContext): Promise<TransactionListDto>;
  deposit(context: HttpRouterContext): Promise<LedgerEntryDto>;
  withdraw(context: HttpRouterContext): Promise<LedgerEntryDto>;
}

export interface WalletControllerOptions {
  readonly commandBus: CommandBus;
  readonly queryBus: QueryBus;
}

export function createWalletController(
  options: WalletControllerOptions,
): WalletController {
  const { commandBus, queryBus } = options;

  return {
    getWallet: async (context) =>
      queryBus.execute<GetWalletQuery, Wallet>(
        new GetWalletQuery(requireParam(context.params, "userId")),
      ),

    listTransactions: async (context) => ({
      items: await queryBus.execute<
        ListTransactionsQuery,
        readonly Transaction[]
      >(new ListTransactionsQuery(requireParam(context.params, "userId"))),
    }),

    deposit: async (context) => {
      const request = parseBody(context.request, depositValidator);

      return commandBus.execute<DepositFundsCommand, LedgerResult>(
        new DepositFundsCommand({
          userId: request.userId,
          amount: request.amount,
          currency: request.currency,
        }),
      );
    },

    withdraw: async (context) => {
      const request = parseBody(context.request, withdrawValidator);

      return commandBus.execute<WithdrawFundsCommand, LedgerResult>(
        new WithdrawFundsCommand({
          userId: request.userId,
          amount: request.amount,
          currency: request.currency,
        }),
      );
    },
  };
}
