/**
 * @betng/gateway/loaders
 *
 * Bootstrap wiring: what gets registered, and with what.
 */

export { loadClients } from "./clients.loader.js";
export { loadContainer } from "./container.loader.js";
export type { ContainerLoaderConfig } from "./container.loader.js";
export { loadProbes } from "./probes.loader.js";
export type { ProbeLoaderConfig } from "./probes.loader.js";
