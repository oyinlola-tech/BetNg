import type { AuthDataSource } from "@betng/ui-core";
import type { KeyValueStorage } from "../engine.js";

export interface MockAuthOptions {
  readonly storage?: KeyValueStorage & { remove?(key: string): void };
  readonly latencyMs?: number;
  readonly now?: () => number;
}

export function createMockAuthSource(_options: MockAuthOptions = {}): AuthDataSource {
  throw new Error("createMockAuthSource is not implemented yet.");
}
