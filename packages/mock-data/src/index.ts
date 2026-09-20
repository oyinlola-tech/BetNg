/**
 * A stand-in platform: a deterministic virtual season that runs on the wall clock, behind the same `BetNgDataSource` the clients use against the real gateway.
 */

export { createMockDataSource } from "./mockDataSource.js";
export type { MockDataSource } from "./mockDataSource.js";

export { MockPlatform } from "./engine.js";
export type { KeyValueStorage, MockPlatformOptions } from "./engine.js";

export { COMPETITIONS, LEAGUES } from "./clubs.js";
export { CYCLE_SECONDS, SEASON_EPOCH_MS } from "./season.js";

export { createMockAuthSource } from "./auth/index.js";
export type { MockAuthOptions } from "./auth/index.js";
export { createMockShopSource } from "./shop/index.js";
export type { MockShopOptions } from "./shop/index.js";
export { createMockAdminSource } from "./admin/index.js";
export type { MockAdminOptions } from "./admin/index.js";
