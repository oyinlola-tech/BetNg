import { QueryHandler } from "@zudojs/cqrs";
import type { MatchEvent } from "@betng/contracts";
import { LIST_LIMIT, MATCH_QUERY } from "../../../../constants/index.js";
import { MatchNotFoundError } from "../../../../errors/index.js";
import { toMatchEvent } from "../../../../models/index.js";
import type { HandlerDependencies } from "../../match.dependencies.js";
import type { ListMatchEventsQuery } from "./listMatchEvents.query.js";

export class ListMatchEventsHandler extends QueryHandler<ListMatchEventsQuery, readonly MatchEvent[]> {
  public readonly queryType = MATCH_QUERY.LIST_MATCH_EVENTS;

  private readonly deps: HandlerDependencies;

  public constructor(deps: HandlerDependencies) {
    super();
    this.deps = deps;
  }

  public async execute(query: ListMatchEventsQuery): Promise<readonly MatchEvent[]> {
    const found = await this.deps.matches.findMatch(query.matchId);

    if (found === undefined) throw new MatchNotFoundError(query.matchId);

    if (found.revealedSequence === 0) return [];

    // Result secrecy: only the part of the timeline the scheduler has already revealed is ever read here.
    const events = await this.deps.simulation.listEvents(found.id, {
      after: 0,
      upTo: found.revealedSequence,
      limit: LIST_LIMIT.EVENTS_MAX,
    });

    return events.map(toMatchEvent).filter((event) => event !== undefined);
  }
}
