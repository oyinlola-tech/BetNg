/**
 * @betng/contracts
 *
 * The shared BetNG domain contracts: TypeScript types plus the validation
 * schemas that back them.
 *
 * This package holds contracts only. It contains no business logic, no I/O
 * and no service-specific behaviour, so every service can depend on it
 * without depending on another service.
 *
 * The contracts are language independent: they describe JSON over HTTP. The
 * Python services implement the same shapes from `docs/api.md` rather than
 * importing anything from here.
 */

export * from "./common/index.js";
export * as match from "./match/index.js";
export * as odds from "./odds/index.js";
export * as betting from "./betting/index.js";
export * as wallet from "./wallet/index.js";
export * as settlement from "./settlement/index.js";
export * as simulation from "./simulation/index.js";
export * as risk from "./risk/index.js";
