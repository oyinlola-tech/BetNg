/**
 * The event service's RPC procedures.
 *
 * Publishing a live event is internal, and RPC is how that is enforced in
 * practice: the gateway forwards REST and forwards nothing to `/rpc`, so the
 * only callers are services inside the platform. The match service calls this
 * as it relays what the simulation decided.
 *
 * This is the concrete form of "clients are consumers, the backend is
 * authoritative": there is no public path to this procedure and no client
 * frame that reaches its handler.
 */

import { createRPCProcedure, RPCServer, RPCValidationError } from "@zudojs/rpc";
import type { CommandBus } from "@zudojs/cqrs";
import { validate } from "@zudojs/validation";
import { EVENT_PROCEDURE } from "../constants/index.js";
import { publishEventPayloadSchema } from "../dtos/index.js";
import type { PublishResult } from "../services/event/commands/index.js";
import { PublishEventCommand } from "../services/event/commands/index.js";

/**
 * Builds the RPC server holding the event procedures.
 *
 * @param commandBus - The bus the publish handler is registered on.
 * @returns The server to mount at `POST /rpc`.
 */
export function createEventRpcServer(commandBus: CommandBus): RPCServer {
  const server = new RPCServer();

  server.register(
    createRPCProcedure<unknown, PublishResult>(
      EVENT_PROCEDURE.PUBLISH_EVENT,
      async (input) => {
        const result = validate(publishEventPayloadSchema, input);

        if (!result.success) {
          throw new RPCValidationError(
            "The payload failed validation.",
            result.issues.map(
              (issue) => `${issue.path.join(".")}: ${issue.message}`,
            ),
            EVENT_PROCEDURE.PUBLISH_EVENT,
          );
        }

        const payload = result.data;

        return commandBus.execute<PublishEventCommand, PublishResult>(
          new PublishEventCommand({
            matchId: payload.matchId,
            type: payload.type,
            minute: payload.minute,
            ...(payload.side === undefined ? {} : { side: payload.side }),
            score: payload.score,
            description: payload.description,
          }),
        );
      },
    ),
  );

  return server;
}
