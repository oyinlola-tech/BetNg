import { QueryHandler } from "@zudojs/cqrs";
import type { Fixture } from "@betng/contracts";
import type { MatchRepository } from "../../interfaces/index.js";
import { ListFixturesQuery } from "./list-fixtures.query.js";

/** Reads every fixture from the match repository. */
export class ListFixturesHandler extends QueryHandler<
  ListFixturesQuery,
  readonly Fixture[]
> {
  public readonly queryType = "match.list-fixtures" as const;

  private readonly repository: MatchRepository;

  public constructor(repository: MatchRepository) {
    super();
    this.repository = repository;
  }

  public async execute(): Promise<readonly Fixture[]> {
    return this.repository.listFixtures();
  }
}
