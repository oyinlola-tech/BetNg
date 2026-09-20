import { Query } from "@zudojs/cqrs";

/** Asks for one match by identifier. */
export class GetMatchQuery extends Query<"match.get-match"> {
  public readonly matchId: string;

  public constructor(matchId: string) {
    super("match.get-match");
    this.matchId = matchId;
  }
}
