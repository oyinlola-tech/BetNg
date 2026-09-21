import type { Container } from "@zudojs/container";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import {
  CATALOGUE_REPOSITORY_TOKEN,
  CLOCK_TOKEN,
  IDENTITY_PEER_TOKEN,
  LIFECYCLE_SERVICE_TOKEN,
  LOGGER_TOKEN,
  MATCH_COMMAND,
  MATCH_QUERY,
  MATCH_REPOSITORY_TOKEN,
  SIMULATION_READER_TOKEN,
  TIMING_TOKEN,
} from "../../constants/index.js";
import {
  CreateFixtureHandler,
  CreateLeagueHandler,
  CreateTeamHandler,
  PerformMatchActionHandler,
  UpdateTeamHandler,
} from "./commands/index.js";
import type { HandlerDependencies } from "./match.dependencies.js";
import {
  GetAdminMatchHandler,
  GetMatchHandler,
  GetMatchStatsHandler,
  GetStandingsHandler,
  ListAdminFixturesHandler,
  ListAdminTeamsHandler,
  ListFixturesHandler,
  ListLeaguesHandler,
  ListMatchEventsHandler,
  ListMatchesHandler,
  ListResultsHandler,
  ListScorersHandler,
  ListTeamsHandler,
} from "./queries/index.js";

export type { CommandActor, HandlerDependencies } from "./match.dependencies.js";

export interface MatchServiceConfig {
  readonly container: Container;
  readonly queryBus: QueryBus;
  readonly commandBus: CommandBus;
}

export function registerMatchService(config: MatchServiceConfig): void {
  const { container, queryBus, commandBus } = config;

  const deps: HandlerDependencies = {
    catalogue: container.resolve(CATALOGUE_REPOSITORY_TOKEN),
    matches: container.resolve(MATCH_REPOSITORY_TOKEN),
    simulation: container.resolve(SIMULATION_READER_TOKEN),
    lifecycle: container.resolve(LIFECYCLE_SERVICE_TOKEN),
    identity: container.resolve(IDENTITY_PEER_TOKEN),
    timing: container.resolve(TIMING_TOKEN),
    clock: container.resolve(CLOCK_TOKEN),
    logger: container.resolve(LOGGER_TOKEN),
  };

  queryBus.register(MATCH_QUERY.LIST_LEAGUES, new ListLeaguesHandler(deps));
  queryBus.register(MATCH_QUERY.LIST_TEAMS, new ListTeamsHandler(deps));
  queryBus.register(MATCH_QUERY.LIST_FIXTURES, new ListFixturesHandler(deps));
  queryBus.register(MATCH_QUERY.LIST_MATCHES, new ListMatchesHandler(deps));
  queryBus.register(MATCH_QUERY.GET_MATCH, new GetMatchHandler(deps));
  queryBus.register(MATCH_QUERY.LIST_MATCH_EVENTS, new ListMatchEventsHandler(deps));
  queryBus.register(MATCH_QUERY.GET_MATCH_STATS, new GetMatchStatsHandler(deps));
  queryBus.register(MATCH_QUERY.LIST_RESULTS, new ListResultsHandler(deps));
  queryBus.register(MATCH_QUERY.GET_STANDINGS, new GetStandingsHandler(deps));
  queryBus.register(MATCH_QUERY.LIST_SCORERS, new ListScorersHandler(deps));
  queryBus.register(MATCH_QUERY.LIST_ADMIN_TEAMS, new ListAdminTeamsHandler(deps));
  queryBus.register(MATCH_QUERY.LIST_ADMIN_FIXTURES, new ListAdminFixturesHandler(deps));
  queryBus.register(MATCH_QUERY.GET_ADMIN_MATCH, new GetAdminMatchHandler(deps));

  commandBus.register(MATCH_COMMAND.CREATE_LEAGUE, new CreateLeagueHandler(deps));
  commandBus.register(MATCH_COMMAND.CREATE_TEAM, new CreateTeamHandler(deps));
  commandBus.register(MATCH_COMMAND.UPDATE_TEAM, new UpdateTeamHandler(deps));
  commandBus.register(MATCH_COMMAND.CREATE_FIXTURE, new CreateFixtureHandler(deps));
  commandBus.register(MATCH_COMMAND.PERFORM_MATCH_ACTION, new PerformMatchActionHandler(deps));
}
