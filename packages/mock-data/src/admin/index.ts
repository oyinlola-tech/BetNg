import type { AdminDataSource } from "@betng/ui-core";
import type { KeyValueStorage, MockPlatform } from "../engine.js";

export interface MockAdminOptions {
  /** The virtual season the control plane observes. */
  readonly platform: MockPlatform;
  readonly storage?: KeyValueStorage & { remove?(key: string): void };
  readonly latencyMs?: number;
}

export function createMockAdminSource(_options: MockAdminOptions): AdminDataSource {
  throw new Error("createMockAdminSource is not implemented yet.");
}
