import { CommandHandler } from "@zudojs/cqrs";
import type { AdminTeam } from "@betng/contracts";
import { isConflictError } from "@zudojs/database";
import { MATCH_COMMAND } from "../../../../constants/index.js";
import { InvalidRequestError, MatchConflictError } from "../../../../errors/index.js";
import { toAdminTeam } from "../../../../models/index.js";
import { DEFAULT_HOME_ADVANTAGE, overallStrength } from "../../../../utils/index.js";
import { recordCatalogueAudit } from "../../catalogueAudit.js";
import type { HandlerDependencies } from "../../match.dependencies.js";
import type { CreateTeamCommand } from "./createTeam.command.js";

export class CreateTeamHandler extends CommandHandler<CreateTeamCommand, AdminTeam> {
  public readonly commandType = MATCH_COMMAND.CREATE_TEAM;

  private readonly deps: HandlerDependencies;

  public constructor(deps: HandlerDependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: CreateTeamCommand): Promise<AdminTeam> {
    const { request, actor } = command;

    if ((await this.deps.catalogue.findLeague(request.leagueId)) === undefined) {
      throw new InvalidRequestError("No league with this id.", "leagueId");
    }

    try {
      const team = await this.deps.catalogue.createTeam({
        leagueId: request.leagueId,
        name: request.name,
        shortName: request.shortName,
        code: request.code,
        city: request.city ?? "",
        stadium: request.stadium ?? "",
        ...(request.colors === undefined
          ? {}
          : { colorPrimary: request.colors.primary, colorSecondary: request.colors.secondary }),
        strength: overallStrength(request.ratings),
        attack: request.ratings.attack,
        midfield: request.ratings.midfield,
        defence: request.ratings.defence,
        goalkeeping: request.ratings.goalkeeper,
        pace: request.ratings.pace,
        finishing: request.ratings.finishing,
        form: request.ratings.form,
        possession: request.possession ?? request.ratings.midfield,
        homeAdvantage: request.homeAdvantage ?? DEFAULT_HOME_ADVANTAGE,
      });
      const created = toAdminTeam(team);

      await recordCatalogueAudit(this.deps, actor, "team_created", "team", team.id, created);

      return created;
    } catch (error) {
      if (isConflictError(error)) throw new MatchConflictError("This league already has a team with this code.");

      throw error;
    }
  }
}
