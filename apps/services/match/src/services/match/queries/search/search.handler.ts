import { QueryHandler } from "@zudojs/cqrs";
import type { SearchResponse } from "@betng/contracts";
import { MATCH_QUERY, SEARCH } from "../../../../constants/index.js";
import type { SearchTerm } from "../../../../interfaces/index.js";
import type { HandlerDependencies } from "../../match.dependencies.js";
import type { SearchQuery } from "./search.query.js";

type SearchKind = (typeof SEARCH.KINDS)[number];
type SearchHit = SearchResponse["hits"][number];

function readKinds(raw: string | undefined): ReadonlySet<SearchKind> {
  if (raw === undefined || raw.trim() === "") return new Set(SEARCH.KINDS);

  const asked = new Set(
    raw.split(",").map((kind) => kind.trim().toUpperCase()),
  );

  return new Set(SEARCH.KINDS.filter((kind) => asked.has(kind)));
}

function toTerm(q: string): SearchTerm {
  const escaped = q.replace(/[\\%_]/g, (character) => `\\${character}`);

  return { pattern: `%${escaped}%`, prefix: `${escaped}%` };
}

export class SearchHandler extends QueryHandler<SearchQuery, SearchResponse> {
  public readonly queryType = MATCH_QUERY.SEARCH;

  private readonly deps: HandlerDependencies;

  public constructor(deps: HandlerDependencies) {
    super();
    this.deps = deps;
  }

  public async execute(query: SearchQuery): Promise<SearchResponse> {
    const { q } = query.input;
    const limit = Math.min(
      query.input.limit ?? SEARCH.DEFAULT_LIMIT,
      SEARCH.MAX_LIMIT,
    );
    const kinds = readKinds(query.input.kinds);
    const term = toTerm(q);
    const { search } = this.deps;
    const now = this.deps.clock().getTime();

    // PLAYER and MARKET are valid kinds with nothing behind them in this service.
    const [leagues, teams, matches] = await Promise.all([
      kinds.has("LEAGUE") ? search.leagues(term, limit) : [],
      kinds.has("TEAM") ? search.teams(term, limit) : [],
      kinds.has("MATCH")
        ? search.matches(
            term,
            {
              from: new Date(now - SEARCH.MATCH_WINDOW_MS),
              to: new Date(now + SEARCH.MATCH_WINDOW_MS),
            },
            limit,
          )
        : [],
    ]);

    const hits: SearchHit[] = [
      ...leagues.map((league): SearchHit => ({
        kind: "LEAGUE",
        id: league.id,
        title: league.name,
        subtitle: league.country,
        leagueId: league.id,
      })),
      ...teams.map((team): SearchHit => ({
        kind: "TEAM",
        id: team.id,
        title: team.name,
        subtitle: team.leagueName,
        teamId: team.id,
        leagueId: team.leagueId,
      })),
      ...matches.map((match): SearchHit => ({
        kind: "MATCH",
        id: match.id,
        title: `${match.homeName} vs ${match.awayName}`.slice(0, 160),
        subtitle: `${match.leagueCode} · Matchday ${String(match.matchday)}`,
        matchId: match.id,
        leagueId: match.leagueId,
      })),
    ];

    return { term: q, hits: hits.slice(0, limit) };
  }
}
