import { Query } from "@zudojs/cqrs";
import { MATCH_QUERY } from "../../../../constants/index.js";

export interface SearchInput {
  readonly q: string;
  readonly kinds?: string | undefined;
  readonly limit?: number | undefined;
}

export class SearchQuery extends Query<"match.search"> {
  public readonly input: SearchInput;

  public constructor(input: SearchInput) {
    super(MATCH_QUERY.SEARCH);
    this.input = input;
  }
}
