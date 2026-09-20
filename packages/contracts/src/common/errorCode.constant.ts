/**
 * The error codes BetNG services return in `error.code`.
 *
 * Defined in the framework-free entry and re-exported here, so a browser
 * client can read them without pulling zod into its bundle.
 */

export { ErrorCodes } from "../runtime.js";
export type { ErrorCode } from "../runtime.js";
