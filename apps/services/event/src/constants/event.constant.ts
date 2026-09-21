export const EVENT_COMMAND = Object.freeze({
  PUBLISH_EVENT: "event.publishEvent",
});

export type EventCommandType =
  (typeof EVENT_COMMAND)[keyof typeof EVENT_COMMAND];

export const EVENT_QUERY = Object.freeze({
  GET_CHANNEL_STATE: "event.getChannelState",
});

export type EventQueryType = (typeof EVENT_QUERY)[keyof typeof EVENT_QUERY];

export const EVENT_PROCEDURE = Object.freeze({
  PUBLISH_EVENT: "event.publish",
});

/**
 * How often an idle connection is pinged.
 *
 * A TV client may watch a match for ninety minutes with long quiet spells
 * between events. Without a heartbeat a proxy closes the socket and the
 * viewer silently stops receiving goals.
 */
export const HEARTBEAT_INTERVAL_MS = 25_000;

/**
 * How long a client has to answer a ping before its socket is closed.
 *
 * Detects a half-open connection — one the peer has gone away from without
 * a close frame — so a dead subscriber is not counted as a live one.
 */
export const HEARTBEAT_TIMEOUT_MS = 10_000;
