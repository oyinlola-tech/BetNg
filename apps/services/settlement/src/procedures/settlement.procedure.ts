import { createRPCProcedure, RPCError, RPCServer, RPCValidationError } from "@zudojs/rpc";
import type { RPCContext } from "@zudojs/rpc";
import type { CommandBus } from "@zudojs/cqrs";
import { isDomainError } from "@zudojs/errors";
import { validate } from "@zudojs/validation";
import type { ValidationSchema } from "@zudojs/validation";
import { SETTLEMENT_PROCEDURE, SYSTEM_ACTOR } from "../constants/index.js";
import type { AuditActor } from "../interfaces/index.js";
import type { MatchSettlementResult } from "../services/index.js";
import { SettleMatchCommand, VoidMatchCommand } from "../services/settlement/commands/index.js";
import { settleMatchPayloadSchema, voidMatchPayloadSchema } from "../validators/index.js";

const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;

function parsePayload<T>(schema: ValidationSchema<T>, input: unknown, procedure: string): T {
  const result = validate(schema, input);

  if (result.success) {
    return result.data;
  }

  throw new RPCValidationError(
    "The payload failed validation.",
    result.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
    procedure,
  );
}

function systemActor(context: RPCContext): AuditActor {
  const inbound = context.metadata.requestId;

  return {
    ...SYSTEM_ACTOR,
    requestId:
      typeof inbound === "string" && SAFE_REQUEST_ID.test(inbound) ? inbound : crypto.randomUUID(),
  };
}

async function answer<T>(procedure: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (isDomainError(error) && error.expose) {
      throw new RPCError(error.message, {
        code: error.code,
        statusCode: error.statusCode,
        expose: true,
        procedureName: procedure,
        cause: error,
      });
    }

    throw error;
  }
}

export function createSettlementRpcServer(commandBus: CommandBus): RPCServer {
  const server = new RPCServer();

  server.register(
    createRPCProcedure<unknown, MatchSettlementResult>(
      SETTLEMENT_PROCEDURE.SETTLE_MATCH,
      async (input, context) => {
        const payload = parsePayload(settleMatchPayloadSchema, input, SETTLEMENT_PROCEDURE.SETTLE_MATCH);

        return answer(SETTLEMENT_PROCEDURE.SETTLE_MATCH, async () =>
          commandBus.execute<SettleMatchCommand, MatchSettlementResult>(
            new SettleMatchCommand({ matchId: payload.matchId, actor: systemActor(context) }),
          ),
        );
      },
      { idempotent: true },
    ),
  );

  server.register(
    createRPCProcedure<unknown, MatchSettlementResult>(
      SETTLEMENT_PROCEDURE.VOID_MATCH,
      async (input, context) => {
        const payload = parsePayload(voidMatchPayloadSchema, input, SETTLEMENT_PROCEDURE.VOID_MATCH);

        return answer(SETTLEMENT_PROCEDURE.VOID_MATCH, async () =>
          commandBus.execute<VoidMatchCommand, MatchSettlementResult>(
            new VoidMatchCommand({
              matchId: payload.matchId,
              reason: payload.reason,
              actor: systemActor(context),
            }),
          ),
        );
      },
      { idempotent: true },
    ),
  );

  return server;
}
