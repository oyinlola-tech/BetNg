/**
 * Builds the module map the ZudoJS runtime starts.
 *
 * A module is the unit whose lifetime matches the application's. The runtime
 * calls `onInitialize` during start and `onShutdown` during stop, in
 * dependency order.
 */

import type { Module } from "@zudojs/core";
import type { MatchRepository } from "../interfaces/index.js";
import { MatchModule } from "../modules/index.js";

/**
 * Creates the match service's modules.
 *
 * @param repository - The repository the match module owns.
 * @returns The modules, keyed by identifier, ready for `createRuntime`.
 */
export function loadModules(
  repository: MatchRepository,
): ReadonlyMap<string, Module> {
  const modules = new Map<string, Module>();
  const matchModule = new MatchModule(repository);

  modules.set(matchModule.id, matchModule);

  return modules;
}
