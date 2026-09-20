import type { ShopDataSource } from "@betng/ui-core";
import type { KeyValueStorage, MockPlatform } from "../engine.js";

export interface MockShopOptions {
  /** The virtual season tickets are sold and settled against. */
  readonly platform: MockPlatform;
  readonly storage?: KeyValueStorage & { remove?(key: string): void };
  readonly latencyMs?: number;
}

export function createMockShopSource(_options: MockShopOptions): ShopDataSource {
  throw new Error("createMockShopSource is not implemented yet.");
}
