import { QueryHandler } from "@zudojs/cqrs";
import type { Fixture } from "@betng/contracts";
import { MATCH_QUERY } from "../../../../constants/index.js";
import type { MatchRepository } from "../../../../interfaces/index.js";
import type { ListFixturesQuery } from "./listFixtures.query.js";

/** Reads every fixture from the match repository. */
export class ListFixturesHandler extends QueryHandler<
  ListFixturesQuery,
  readonly Fixture[]
> {
  public readonly queryType = MATCH_QUERY.LIST_FIXTURES;

  private readonly matches: MatchRepository;

  public constructor(matches: MatchRepository) {
    super();
    this.matches = matches;
  }

  public async execute(): Promise<readonly Fixture[]> {
    return this.matches.listFixtures();
  }
}
