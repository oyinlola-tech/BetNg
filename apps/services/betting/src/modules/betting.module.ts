import { BaseModule, type ModuleContext } from "@zudojs/core";
import type { BetRepository } from "../repositories/betRepository.js";

/**
 * The betting module.
 *
 * Owns bet state and nothing else. It holds no client for the simulation
 * service, which is what makes "betting cannot influence a result" a
 * property of the wiring rather than a promise in a document.
 */
export class BettingModule extends BaseModule {
  public readonly id = "betting";
  public readonly name = "betting";

  readonly #repository: BetRepository;

  public constructor(repository: BetRepository) {
    super({ version: "0.1.0" });
    this.#repository = repository;
  }

  public get repository(): BetRepository {
    return this.#repository;
  }

  public override onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("Betting module initialized");
    return Promise.resolve();
  }

  public override onShutdown(context: ModuleContext): Promise<void> {
    context.logger.info("Betting module stopped");
    return Promise.resolve();
  }
}
