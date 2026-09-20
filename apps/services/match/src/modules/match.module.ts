import { BaseModule } from "@zudojs/core";
import type { ModuleContext } from "@zudojs/core";
import type { MatchRepository } from "../interfaces/index.js";

/**
 * The match module.
 *
 * Owns the competition structure and the match lifecycle. The ZudoJS runtime
 * drives its lifecycle, which is where a resource whose lifetime matches the
 * application's belongs — the database connection, once the match schema
 * exists.
 */
export class MatchModule extends BaseModule {
  public readonly id = "match";

  public readonly name = "match";

  private readonly matchRepository: MatchRepository;

  public constructor(repository: MatchRepository) {
    super({ version: "0.1.0" });
    this.matchRepository = repository;
  }

  /** The repository this module owns. */
  public get repository(): MatchRepository {
    return this.matchRepository;
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    const leagues = await this.matchRepository.listLeagues();

    context.logger.info("Match module initialized", {
      leagues: leagues.length,
    });
  }

  public override async onShutdown(context: ModuleContext): Promise<void> {
    context.logger.info("Match module stopped");
  }
}
