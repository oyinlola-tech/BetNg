/**
 * The types the live hooks work with.
 *
 * Split from the domain re-exports so a hook imports one narrow module
 * rather than the whole contract surface.
 */

export type { LiveClient } from "@betng/client-sdk";
export type { LiveEvent, LiveEventType, Match } from "@betng/contracts";
