import { createRPCProcedure, RPCError, RPCServer, RPCValidationError } from "@zudojs/rpc";
import { isDomainError } from "@zudojs/errors";
import { validate } from "@zudojs/validation";
import type { ValidationSchema } from "@zudojs/validation";
import { EMAIL_PROCEDURE } from "../constants/index.js";
import { MessageNotFoundError } from "../errors/index.js";
import type { DeliveryService, SendOutcome } from "../services/index.js";
import { messageStatusPayloadValidator, sendEmailPayloadValidator } from "../validators/index.js";

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

export interface MessageStatusResult {
  readonly id: string;
  readonly status: string;
  readonly template: string;
  readonly attempts: number;
  readonly lastEventAt: string | undefined;
}

export function createEmailRpcServer(delivery: DeliveryService): RPCServer {
  const server = new RPCServer();

  server.register(
    createRPCProcedure<unknown, SendOutcome>(
      EMAIL_PROCEDURE.SEND,
      async (input) => {
        const payload = parsePayload(sendEmailPayloadValidator, input, EMAIL_PROCEDURE.SEND);

        return answer(EMAIL_PROCEDURE.SEND, async () =>
          delivery.send({
            to: payload.to,
            template: payload.template,
            variables: payload.variables,
            idempotencyKey: payload.idempotencyKey,
            ...(payload.tags === undefined ? {} : { tags: payload.tags }),
            ...(payload.replyTo === undefined ? {} : { replyTo: payload.replyTo }),
          }),
        );
      },
      { idempotent: true },
    ),
  );

  server.register(
    createRPCProcedure<unknown, MessageStatusResult>(
      EMAIL_PROCEDURE.STATUS,
      async (input) => {
        const payload = parsePayload(messageStatusPayloadValidator, input, EMAIL_PROCEDURE.STATUS);

        return answer(EMAIL_PROCEDURE.STATUS, async () => {
          const message = await delivery.status(payload.id);

          if (message === undefined) {
            throw new MessageNotFoundError(payload.id);
          }

          // The address is deliberately absent: a caller asking about delivery does not need it back.
          return {
            id: message.id,
            status: message.status,
            template: message.template,
            attempts: message.attempts,
            lastEventAt: message.lastEventAt?.toISOString(),
          };
        });
      },
      { idempotent: true },
    ),
  );

  return server;
}
