import { Query } from "@zudojs/cqrs";

/** Asks for every scheduled fixture. */
export class ListFixturesQuery extends Query<"match.list-fixtures"> {
  public constructor() {
    super("match.list-fixtures");
  }
}
