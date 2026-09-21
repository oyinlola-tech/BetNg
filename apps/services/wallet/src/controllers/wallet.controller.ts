import { randomUUID } from "node:crypto";
import { ErrorCodes } from "@betng/contracts";
import {
  forbidden,
  notFound,
  parseBody,
  parseQuery,
  requireActor,
  requireParam,
  unprocessableEntity,
} from "@betng/service-kit";
import type { Actor, HttpRouterContext } from "@betng/service-kit";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import type { WalletSettings } from "../configs/index.js";
import {
  IDEMPOTENCY_KEY_HEADER,
  WALLET_PERMISSION,
} from "../constants/index.js";
import type {
  LedgerEntryDto,
  ShopTransactionListDto,
  TransactionListDto,
  WalletDto,
  WalletOverviewDto,
} from "../dtos/index.js";
import type {
  AccountRecord,
  EntryRecord,
  OverviewRecord,
  PostEntryResult,
  ShopEntryRecord,
} from "../interfaces/index.js";
import {
  DepositFundsCommand,
  WithdrawFundsCommand,
} from "../services/wallet/commands/index.js";
import {
  GetWalletOverviewQuery,
  GetWalletQuery,
  ListShopTransactionsQuery,
  ListTransactionsQuery,
} from "../services/wallet/queries/index.js";
import {
  toShopTransaction,
  toTransactionDto,
  toWalletDto,
  toWalletOverviewDto,
  utcDayRange,
  utcToday,
} from "../utils/index.js";
import {
  createFundsRequestSchema,
  idempotencyHeaderSchema,
  listQuerySchema,
  ownerIdSchema,
  shopTransactionsQuerySchema,
} from "../validators/index.js";
import type { FundsRequest } from "../validators/index.js";

type Handler<T> = (context: HttpRouterContext) => Promise<T>;

export interface WalletController {
  readonly getWallet: Handler<WalletDto>;
  readonly listTransactions: Handler<TransactionListDto>;
  readonly deposit: Handler<LedgerEntryDto>;
  readonly withdraw: Handler<LedgerEntryDto>;
  readonly listShopTransactions: Handler<ShopTransactionListDto>;
  readonly getOverview: Handler<WalletOverviewDto>;
}

export interface WalletControllerOptions {
  readonly commandBus: CommandBus;
  readonly queryBus: QueryBus;
  readonly settings: WalletSettings;
}

const SELF = "me";

function deny(): never {
  throw forbidden("You do not have permission to do this.", {
    code: ErrorCodes.FORBIDDEN,
    expose: true,
  });
}

function isUuid(value: string | undefined): value is string {
  return ownerIdSchema.safeParse(value).success;
}

/** A customer reads only their own wallet; an admin holding `wallet:read` reads any. The id never comes from a body. */
function readableCustomerId(context: HttpRouterContext): string {
  const actor = requireActor(context.request, { kind: ["CUSTOMER", "ADMIN"] });
  const requested = requireParam(context.params, "userId");

  if (actor.kind === "CUSTOMER") {
    if ((requested !== SELF && requested !== actor.id) || !isUuid(actor.id)) {
      deny();
    }

    return actor.id;
  }

  if (!actor.permissions.includes(WALLET_PERMISSION.ADMIN_READ)) {
    deny();
  }

  if (!isUuid(requested)) {
    throw notFound("No wallet exists for that owner.", {
      code: ErrorCodes.NOT_FOUND,
      expose: true,
    });
  }

  return requested;
}

function requireCustomer(context: HttpRouterContext): Actor {
  const actor = requireActor(context.request, { kind: "CUSTOMER" });

  if (!isUuid(actor.id)) {
    deny();
  }

  return actor;
}

function readIdempotencyKey(
  context: HttpRouterContext,
  request: FundsRequest,
): string {
  const header = context.request.getHeader(IDEMPOTENCY_KEY_HEADER);

  if (header === undefined || header === "") {
    return request.idempotencyKey ?? randomUUID();
  }

  const parsed = idempotencyHeaderSchema.safeParse(header);

  if (!parsed.success) {
    throw unprocessableEntity("The idempotency-key header is not valid.", {
      code: ErrorCodes.VALIDATION_FAILED,
      expose: true,
    });
  }

  return parsed.data;
}

function toLedgerEntryDto(result: PostEntryResult): LedgerEntryDto {
  return {
    wallet: toWalletDto(result.account),
    transaction: toTransactionDto(result.entry),
  };
}

export function createWalletController(
  options: WalletControllerOptions,
): WalletController {
  const { commandBus, queryBus, settings } = options;

  const depositSchema = createFundsRequestSchema(settings.depositMaxKobo);
  const withdrawalSchema = createFundsRequestSchema(settings.withdrawalMaxKobo);

  return {
    getWallet: async (context) => {
      const customerId = readableCustomerId(context);

      return toWalletDto(
        await queryBus.execute<GetWalletQuery, AccountRecord>(
          new GetWalletQuery("CUSTOMER", customerId),
        ),
      );
    },

    listTransactions: async (context) => {
      const customerId = readableCustomerId(context);
      const { limit } = parseQuery(context.query, listQuerySchema);

      const entries = await queryBus.execute<
        ListTransactionsQuery,
        readonly EntryRecord[]
      >(
        new ListTransactionsQuery({
          ownerType: "CUSTOMER",
          ownerId: customerId,
          limit,
        }),
      );

      return { items: entries.map(toTransactionDto) };
    },

    deposit: async (context) => {
      const actor = requireCustomer(context);
      const request = parseBody(context.request, depositSchema);

      return toLedgerEntryDto(
        await commandBus.execute<DepositFundsCommand, PostEntryResult>(
          new DepositFundsCommand({
            customerId: actor.id,
            amount: request.amount,
            idempotencyKey: readIdempotencyKey(context, request),
          }),
        ),
      );
    },

    withdraw: async (context) => {
      const actor = requireCustomer(context);
      const request = parseBody(context.request, withdrawalSchema);

      return toLedgerEntryDto(
        await commandBus.execute<WithdrawFundsCommand, PostEntryResult>(
          new WithdrawFundsCommand({
            customerId: actor.id,
            amount: request.amount,
            idempotencyKey: readIdempotencyKey(context, request),
          }),
        ),
      );
    },

    listShopTransactions: async (context) => {
      const actor = requireActor(context.request, {
        kind: "CASHIER",
        permission: WALLET_PERMISSION.SHOP_TRANSACTIONS_READ,
      });

      if (!isUuid(actor.shopId)) {
        deny();
      }

      const query = parseQuery(context.query, shopTransactionsQuerySchema);
      const range =
        query.date === undefined ? utcToday() : utcDayRange(query.date);

      if (range === undefined) {
        throw unprocessableEntity("The query string failed validation.", {
          code: ErrorCodes.VALIDATION_FAILED,
          expose: true,
          details: [{ path: "date", message: "That is not a calendar date." }],
        });
      }

      const entries = await queryBus.execute<
        ListShopTransactionsQuery,
        readonly ShopEntryRecord[]
      >(
        new ListShopTransactionsQuery({
          shopId: actor.shopId,
          range,
          limit: query.limit,
        }),
      );

      return { items: entries.map(toShopTransaction) };
    },

    getOverview: async (context) => {
      requireActor(context.request, {
        kind: "ADMIN",
        permission: WALLET_PERMISSION.ADMIN_READ,
      });

      const { limit } = parseQuery(context.query, listQuerySchema);

      return toWalletOverviewDto(
        await queryBus.execute<GetWalletOverviewQuery, OverviewRecord>(
          new GetWalletOverviewQuery({ today: utcToday(), limit }),
        ),
      );
    },
  };
}
