// Internal only: /rpc answers only callers holding the internal token, and the gateway never forwards to it.

import { createRPCProcedure, RPCServer, RPCValidationError } from "@zudojs/rpc";
import type { CommandBus } from "@zudojs/cqrs";
import { validate } from "@zudojs/validation";
import type { ValidationSchema } from "@zudojs/validation";
import { EVENT_PROCEDURE } from "../constants/index.js";
import type { RevokeRequest } from "../controllers/index.js";
import {
  publishEventPayloadSchema,
  publishSignalPayloadSchema,
  revokeSessionsPayloadSchema,
} from "../dtos/index.js";
import type { PublishResult, SignalResult } from "../services/event/commands/index.js";
import { PublishEventCommand, PublishSignalCommand } from "../services/event/commands/index.js";

export interface SessionRevoker {
  revoke(request: RevokeRequest): number;
}

function parse<T>(schema: ValidationSchema<T>, input: unknown, procedure: string): T {
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

export function createEventRpcServer(commandBus: CommandBus, sessions: SessionRevoker): RPCServer {
  const server = new RPCServer();

  server.register(
    createRPCProcedure<unknown, PublishResult>(EVENT_PROCEDURE.PUBLISH_EVENT, async (input) => {
      const payload = parse(publishEventPayloadSchema, input, EVENT_PROCEDURE.PUBLISH_EVENT);

      return commandBus.execute<PublishEventCommand, PublishResult>(
        new PublishEventCommand({
          matchId: payload.matchId,
          type: payload.type,
          minute: payload.minute,
          ...(payload.side === undefined ? {} : { side: payload.side }),
          score: payload.score,
          description: payload.description,
          ...(payload.clock === undefined ? {} : { clock: payload.clock }),
        }),
      );
    }),
  );

  server.register(
    createRPCProcedure<unknown, SignalResult>(EVENT_PROCEDURE.PUBLISH_SIGNAL, async (input) => {
      const payload = parse(publishSignalPayloadSchema, input, EVENT_PROCEDURE.PUBLISH_SIGNAL);

      return commandBus.execute<PublishSignalCommand, SignalResult>(new PublishSignalCommand(payload));
    }),
  );

  server.register(
    createRPCProcedure<unknown, { readonly revoked: number }>(EVENT_PROCEDURE.REVOKE_SESSIONS, async (input) => {
      const payload = parse(revokeSessionsPayloadSchema, input, EVENT_PROCEDURE.REVOKE_SESSIONS);

      return Promise.resolve({
        revoked: sessions.revoke({
          ...(payload.tokenHash === undefined ? {} : { tokenHash: payload.tokenHash }),
          ...(payload.userId === undefined ? {} : { userId: payload.userId }),
        }),
      });
    }),
  );

  return server;
}
