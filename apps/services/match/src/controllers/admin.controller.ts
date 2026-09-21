import type { AdminFixture, AdminPermission, AdminTeam, League } from "@betng/contracts";
import { getRequestId, parseBody, parseQuery, requireActor } from "@betng/service-kit";
import type { HttpRouterContext } from "@betng/service-kit";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import type { AdminMatchDto, ItemsDto } from "../dtos/index.js";
import type { CommandActor } from "../services/index.js";
import {
  CreateFixtureCommand,
  CreateLeagueCommand,
  CreateTeamCommand,
  PerformMatchActionCommand,
  UpdateTeamCommand,
} from "../services/match/commands/index.js";
import {
  GetAdminMatchQuery,
  ListAdminFixturesQuery,
  ListAdminTeamsQuery,
  ListLeaguesQuery,
} from "../services/match/queries/index.js";
import {
  adminFixturesQueryValidator,
  createFixtureValidator,
  createLeagueValidator,
  createTeamValidator,
  listTeamsQueryValidator,
  matchActionValidator,
  updateTeamValidator,
} from "../validators/index.js";
import { idParam } from "./match.controller.js";

export interface AdminController {
  readonly listLeagues: (context: HttpRouterContext) => Promise<ItemsDto<League>>;
  readonly createLeague: (context: HttpRouterContext) => Promise<League>;
  readonly listTeams: (context: HttpRouterContext) => Promise<ItemsDto<AdminTeam>>;
  readonly createTeam: (context: HttpRouterContext) => Promise<AdminTeam>;
  readonly updateTeam: (context: HttpRouterContext) => Promise<AdminTeam>;
  readonly listFixtures: (context: HttpRouterContext) => Promise<ItemsDto<AdminFixture>>;
  readonly createFixture: (context: HttpRouterContext) => Promise<AdminFixture>;
  readonly getMatch: (context: HttpRouterContext) => Promise<AdminMatchDto>;
  readonly performMatchAction: (context: HttpRouterContext) => Promise<AdminMatchDto>;
}

/** The permission is re-checked here: the gateway's route table is not this service's only line of defence. */
function requireAdmin(context: HttpRouterContext, permission: AdminPermission): CommandActor {
  const actor = requireActor(context.request, { kind: "ADMIN", permission });

  return { id: actor.id, role: actor.role, label: `admin:${actor.id}`.slice(0, 80), requestId: getRequestId(context.request) };
}

export function createAdminController(queryBus: QueryBus, commandBus: CommandBus): AdminController {
  return {
    listLeagues: async (context) => {
      requireAdmin(context, "catalogue:read");

      return { items: await queryBus.execute<ListLeaguesQuery, readonly League[]>(new ListLeaguesQuery()) };
    },

    createLeague: async (context) => {
      const actor = requireAdmin(context, "catalogue:write");
      const request = parseBody(context.request, createLeagueValidator);

      return commandBus.execute<CreateLeagueCommand, League>(new CreateLeagueCommand({ request, actor }));
    },

    listTeams: async (context) => {
      requireAdmin(context, "catalogue:read");

      const query = parseQuery(context.query, listTeamsQueryValidator);

      return {
        items: await queryBus.execute<ListAdminTeamsQuery, readonly AdminTeam[]>(new ListAdminTeamsQuery(query.leagueId)),
      };
    },

    createTeam: async (context) => {
      const actor = requireAdmin(context, "catalogue:write");
      const request = parseBody(context.request, createTeamValidator);

      return commandBus.execute<CreateTeamCommand, AdminTeam>(new CreateTeamCommand({ request, actor }));
    },

    updateTeam: async (context) => {
      const actor = requireAdmin(context, "catalogue:write");
      const teamId = idParam(context, "team");
      const request = parseBody(context.request, updateTeamValidator);

      return commandBus.execute<UpdateTeamCommand, AdminTeam>(new UpdateTeamCommand({ teamId, request, actor }));
    },

    listFixtures: async (context) => {
      requireAdmin(context, "fixtures:read");

      return {
        items: await queryBus.execute<ListAdminFixturesQuery, readonly AdminFixture[]>(
          new ListAdminFixturesQuery(parseQuery(context.query, adminFixturesQueryValidator)),
        ),
      };
    },

    createFixture: async (context) => {
      const actor = requireAdmin(context, "fixtures:operate");
      const request = parseBody(context.request, createFixtureValidator);

      return commandBus.execute<CreateFixtureCommand, AdminFixture>(new CreateFixtureCommand({ request, actor }));
    },

    getMatch: async (context) => {
      requireAdmin(context, "fixtures:read");

      return queryBus.execute<GetAdminMatchQuery, AdminMatchDto>(new GetAdminMatchQuery(idParam(context, "match")));
    },

    performMatchAction: async (context) => {
      const actor = requireAdmin(context, "fixtures:operate");
      const matchId = idParam(context, "match");
      const request = parseBody(context.request, matchActionValidator);

      return commandBus.execute<PerformMatchActionCommand, AdminMatchDto>(
        new PerformMatchActionCommand({ matchId, request, actor }),
      );
    },
  };
}
