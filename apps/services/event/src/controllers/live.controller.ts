/**
 * The live WebSocket protocol.
 *
 * Handles what a client may do: subscribe to a match, unsubscribe, and answer
 * a heartbeat. That is the whole client vocabulary.
 *
 * A client cannot publish. Not "is not allowed to" — there is no frame in the
 * protocol that produces an event, and the only handler that does is reachable
 * from inside the platform. A compromised client can make this service send
 * it nothing it would not already have sent.
 */

import {
  clientFrameSchema,
  ErrorCodes,
  MATCH_CHANNEL_PATTERN,
} from "@betng/contracts";
import type { ServerFrame } from "@betng/contracts";
import type { Logger, WebSocketSession } from "@betng/service-kit";
import type { QueryBus } from "@zudojs/cqrs";
import { validate } from "@zudojs/validation";
import type { ChannelRegistry, ChannelState } from "../interfaces/index.js";
import { GetChannelStateQuery } from "../services/event/queries/index.js";

export interface LiveControllerOptions {
  readonly channels: ChannelRegistry;
  readonly queryBus: QueryBus;
  readonly logger: Logger;
}

export interface LiveController {
  onConnection(session: WebSocketSession): void;
  onMessage(session: WebSocketSession, data: string): Promise<void>;
  onClose(session: WebSocketSession): void;
}

function send(session: WebSocketSession, frame: ServerFrame): void {
  session.send(JSON.stringify(frame));
}

export function createLiveController(
  options: LiveControllerOptions,
): LiveController {
  const { channels, queryBus, logger } = options;

  function reject(
    session: WebSocketSession,
    code: string,
    message: string,
  ): void {
    send(session, { type: "ERROR", code, message });
  }

  async function subscribe(
    session: WebSocketSession,
    channel: string,
  ): Promise<void> {
    // Only match channels exist. Refusing anything else stops a client
    // opening an unbounded number of channels the service would then track.
    if (!MATCH_CHANNEL_PATTERN.test(channel)) {
      reject(
        session,
        ErrorCodes.NOT_FOUND,
        `"${channel}" is not a channel this service serves. Subscribe to ` +
          `match:{matchId}.`,
      );
      return;
    }

    channels.subscribe(session, channel);

    const state = await queryBus.execute<GetChannelStateQuery, ChannelState>(
      new GetChannelStateQuery(channel),
    );

    send(session, {
      type: "SUBSCRIBED",
      channel,
      lastSequence: state.lastSequence,
    });

    logger.debug("Client subscribed", {
      connectionId: session.id,
      channel,
      lastSequence: state.lastSequence,
    });
  }

  return {
    onConnection: (session) => {
      channels.open(session);

      send(session, {
        type: "WELCOME",
        connectionId: session.id,
        serverTime: new Date().toISOString(),
      });

      logger.info("Live client connected", { connectionId: session.id });
    },

    onMessage: async (session, data) => {
      let parsed: unknown;

      try {
        parsed = JSON.parse(data);
      } catch {
        reject(
          session,
          ErrorCodes.VALIDATION_FAILED,
          "The frame is not valid JSON.",
        );
        return;
      }

      const result = validate(clientFrameSchema, parsed);

      if (!result.success) {
        reject(
          session,
          ErrorCodes.VALIDATION_FAILED,
          "The frame is not one this protocol defines. A client may send " +
            "SUBSCRIBE, UNSUBSCRIBE or PONG.",
        );
        return;
      }

      const frame = result.data;

      switch (frame.type) {
        case "SUBSCRIBE":
          await subscribe(session, frame.channel);
          return;

        case "UNSUBSCRIBE":
          channels.unsubscribe(session, frame.channel);
          send(session, { type: "UNSUBSCRIBED", channel: frame.channel });
          return;

        case "PONG":
          channels.markAlive(session);
          return;
      }
    },

    onClose: (session) => {
      channels.close(session);
      logger.info("Live client disconnected", { connectionId: session.id });
    },
  };
}
