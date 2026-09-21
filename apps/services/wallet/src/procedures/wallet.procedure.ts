import { isDomainError, RPCError } from "@zudojs/errors";
import { createRPCProcedure, RPCServer, RPCValidationError } from "@zudojs/rpc";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import { validate } from "@zudojs/validation";
import type { ValidationSchema } from "@zudojs/validation";
import { WALLET_PROCEDURE } from "../constants/index.js";
import type { BalanceDto, PostEntryDto } from "../dtos/index.js";
import type { AccountRecord, PostEntryResult } from "../interfaces/index.js";
import { PostEntryCommand } from "../services/wallet/commands/index.js";
import { GetWalletQuery } from "../services/wallet/queries/index.js";
import { toTransactionDto, toWalletDto } from "../utils/index.js";
import {
  balancePayloadSchema,
  creditPayloadSchema,
  debitPayloadSchema,
} from "../validators/index.js";
import type { CreditPayload, DebitPayload } from "../validators/index.js";

export interface WalletRpcOptions {
  readonly commandBus: CommandBus;
  readonly queryBus: QueryBus;
}

function parsePayload<T>(
  schema: ValidationSchema<T>,
  input: unknown,
  procedure: string,
): T {
  const result = validate(schema, input);

  if (!result.success) {
    throw new RPCValidationError(
      "The payload failed validation.",
      result.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
      procedure,
    );
  }

  return result.data;
}

/** A domain failure travels as its platform code (`INSUFFICIENT_FUNDS`, `NOT_FOUND`, …); anything else stays internal. */
async function withDomainErrors<T>(
  procedure: string,
  run: () => Promise<T>,
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (isDomainError(error)) {
      throw new RPCError(error.message, {
        code: error.code,
        statusCode: error.statusCode,
        expose: true,
        procedureName: procedure,
      });
    }

    throw error;
  }
}

/** Internal only: the gateway never forwards to `/rpc`, and the route requires the internal token. */
export function createWalletRpcServer(options: WalletRpcOptions): RPCServer {
  const { commandBus, queryBus } = options;
  const server = new RPCServer();

  async function post(
    procedure: string,
    payload: DebitPayload | CreditPayload,
    amount: bigint,
  ): Promise<PostEntryDto> {
    const result = await withDomainErrors(procedure, async () =>
      commandBus.execute<PostEntryCommand, PostEntryResult>(
        new PostEntryCommand({
          ownerType: payload.ownerType,
          ownerId: payload.ownerId,
          type: payload.type,
          amount,
          idempotencyKey: payload.idempotencyKey,
          ...(payload.reference === undefined
            ? {}
            : { reference: payload.reference }),
          ...(payload.note === undefined ? {} : { note: payload.note }),
          ...(payload.actorId === undefined ? {} : { actorId: payload.actorId }),
        }),
      ),
    );

    return {
      wallet: toWalletDto(result.account),
      transaction: toTransactionDto(result.entry),
      duplicate: result.duplicate,
    };
  }

  server.register(
    createRPCProcedure<unknown, PostEntryDto>(
      WALLET_PROCEDURE.DEBIT,
      async (input) => {
        const payload = parsePayload(
          debitPayloadSchema,
          input,
          WALLET_PROCEDURE.DEBIT,
        );

        return post(WALLET_PROCEDURE.DEBIT, payload, -BigInt(payload.amount));
      },
    ),
  );

  server.register(
    createRPCProcedure<unknown, PostEntryDto>(
      WALLET_PROCEDURE.CREDIT,
      async (input) => {
        const payload = parsePayload(
          creditPayloadSchema,
          input,
          WALLET_PROCEDURE.CREDIT,
        );

        return post(WALLET_PROCEDURE.CREDIT, payload, BigInt(payload.amount));
      },
    ),
  );

  server.register(
    createRPCProcedure<unknown, BalanceDto>(
      WALLET_PROCEDURE.GET_BALANCE,
      async (input) => {
        const payload = parsePayload(
          balancePayloadSchema,
          input,
          WALLET_PROCEDURE.GET_BALANCE,
        );

        const account = await withDomainErrors(
          WALLET_PROCEDURE.GET_BALANCE,
          async () =>
            queryBus.execute<GetWalletQuery, AccountRecord>(
              new GetWalletQuery(payload.ownerType, payload.ownerId),
            ),
        );

        return { wallet: toWalletDto(account) };
      },
    ),
  );

  return server;
}
