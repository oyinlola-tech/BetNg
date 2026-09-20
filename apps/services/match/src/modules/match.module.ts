import { BaseModule, type ModuleContext } from "@zudojs/core";
import type { MatchRepository } from "../repositories/matchRepository.js";

/**
 * The match module.
 *
 * Registered with the ZudoJS runtime in `app.ts`. The runtime calls
 * `onInitialize` during start and `onShutdown` during stop, which is where a
 * resource whose lifetime matches the application's belongs — the database
 * connection, once the match schema exists.
 */
export class MatchModule extends BaseModule {
  public readonly id = "match";
  public readonly name = "match";

  readonly #repository: MatchRepository;

  public constructor(repository: MatchRepository) {
    super({ version: "0.1.0" });
    this.#repository = repository;
  }

  /** The repository this module owns, for handlers resolved from it. */
  public get repository(): MatchRepository {
    return this.#repository;
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    const leagues = await this.#repository.listLeagues();
    context.logger.info("Match module initialized", {
      leagues: leagues.length,
    });
  }

  public override onShutdown(context: ModuleContext): Promise<void> {
    context.logger.info("Match module stopped");
    return Promise.resolve();
  }
}
