/**
 * The connection heartbeat.
 *
 * A TV client may watch a match for ninety minutes with long quiet spells
 * between events. Without traffic a proxy closes the socket, and the viewer
 * silently stops receiving goals — the worst kind of failure, because
 * nothing looks wrong.
 *
 * The heartbeat also detects the reverse: a peer that went away without a
 * close frame. Those sockets are closed so a dead subscriber is not counted
 * as a live one.
 */

import type { Logger } from "@betng/service-kit";
import {
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_TIMEOUT_MS,
} from "../constants/index.js";
import type { ChannelRegistry } from "../interfaces/index.js";

/** Stops the heartbeat. */
export type StopHeartbeat = () => void;

/**
 * Starts pinging open connections.
 *
 * @param channels - The registry of open connections.
 * @param logger - Where closed-stale connections are reported.
 * @returns A function that stops the heartbeat.
 */
export function loadHeartbeat(
  channels: ChannelRegistry,
  logger: Logger,
): StopHeartbeat {
  const timer = setInterval(() => {
    for (const session of channels.stale(
      HEARTBEAT_INTERVAL_MS + HEARTBEAT_TIMEOUT_MS,
    )) {
      logger.debug("Closing unresponsive live connection", {
        connectionId: session.id,
      });
      session.close(1001, "No heartbeat");
      channels.close(session);
    }

    const frame = JSON.stringify({
      type: "PING",
      serverTime: new Date().toISOString(),
    });

    for (const session of channels.connections()) {
      session.send(frame);
    }
  }, HEARTBEAT_INTERVAL_MS);

  // The heartbeat must not keep an otherwise-finished process alive.
  timer.unref();

  return () => {
    clearInterval(timer);
  };
}
