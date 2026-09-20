import { Query } from "@zudojs/cqrs";

/** Asks for every league the platform runs. */
export class ListLeaguesQuery extends Query<"match.list-leagues"> {
  public constructor() {
    super("match.list-leagues");
  }
}
