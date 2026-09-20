/**
 * The state of the live connection, as every client shows it.
 */

export type ConnectionState =
  | "CONNECTING"
  | "CONNECTED"
  | "RECONNECTING"
  | "OFFLINE";
