/**
 * @betng/match-service/loaders
 *
 * Bootstrap wiring: what gets registered, and with what.
 */

export { loadCqrs } from "./cqrs.loader.js";
export type { CqrsLoaderOptions } from "./cqrs.loader.js";
export { loadModules } from "./modules.loader.js";
