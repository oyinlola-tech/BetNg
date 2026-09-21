import {
  createRPCError,
  createRPCProcedure,
  RPCServer,
  RPCValidationError,
} from "@zudojs/rpc";
import type { CommandBus } from "@zudojs/cqrs";
import { validate } from "@zudojs/validation";
import { ErrorCodes } from "@betng/contracts";
import type { BetStatus } from "@betng/contracts";
import { BETTING_PROCEDURE } from "../constants/index.js";
import type { SettlementResult } from "../interfaces/index.js";
import { ApplySettlementCommand } from "../services/betting/commands/index.js";
import { applySettlementValidator } from "../validators/index.js";

export interface ApplySettlementOutput {
  readonly betId: string;
  readonly status: BetStatus;
}

const PROCEDURE = BETTING_PROCEDURE.APPLY_SETTLEMENT;

function refusal(code: string, message: string): Error {
  return createRPCError(message, {
    code,
    expose: true,
    procedureName: PROCEDURE,
  });
}

export function createBettingRpcServer(commandBus: CommandBus): RPCServer {
  const server = new RPCServer();

  server.register(
    createRPCProcedure<unknown, ApplySettlementOutput>(
      PROCEDURE,
      async (input, context) => {
        const parsed = validate(applySettlementValidator, input);

        if (!parsed.success) {
          throw new RPCValidationError(
            "The payload failed validation.",
            parsed.issues.map(
              (issue) => `${issue.path.join(".")}: ${issue.message}`,
            ),
            PROCEDURE,
          );
        }

        const payload = parsed.data;
        const requestId = context.metadata.requestId;

        const result = await commandBus.execute<
          ApplySettlementCommand,
          SettlementResult
        >(
          new ApplySettlementCommand(
            {
              betId: payload.betId,
              outcome: payload.outcome,
              payout: payload.payout,
              legs: payload.legs.map((leg) => ({
                selectionId: leg.selectionId,
                outcome: leg.outcome,
                result: leg.result ?? undefined,
              })),
              settledAt: new Date(payload.settledAt),
            },
            typeof requestId === "string" ? requestId : undefined,
          ),
        );

        switch (result.kind) {
          case "NOT_FOUND":
            throw refusal(ErrorCodes.NOT_FOUND, "No such bet.");
          case "UNKNOWN_LEG":
            throw new RPCValidationError(
              "A leg does not belong to this bet.",
              [`legs: ${result.selectionId} is not on the bet`],
              PROCEDURE,
            );
          case "INVALID_PAYOUT":
            throw new RPCValidationError(
              "The payout does not fit the outcome and the accepted bet.",
              ["payout: LOST pays 0, VOID the stake, WON at most the potential payout"],
              PROCEDURE,
            );
          case "CONFLICT":
            throw refusal(
              ErrorCodes.CONFLICT,
              `The bet is already settled as ${result.status}.`,
            );
          default:
            return { betId: payload.betId, status: result.status };
        }
      },
    ),
  );

  return server;
}
