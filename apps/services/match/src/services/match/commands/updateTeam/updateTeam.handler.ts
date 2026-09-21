import { CommandHandler } from "@zudojs/cqrs";
import { ErrorCodes } from "@betng/contracts";
import type { AdminTeam } from "@betng/contracts";
import { MATCH_COMMAND } from "../../../../constants/index.js";
import { NotFoundError, PeerFailedError } from "../../../../errors/index.js";
import type { TeamPatch } from "../../../../interfaces/index.js";
import { toAdminTeam } from "../../../../models/index.js";
import { definedOnly, overallStrength } from "../../../../utils/index.js";
import type { HandlerDependencies } from "../../match.dependencies.js";
import type { UpdateTeamCommand } from "./updateTeam.command.js";

export class UpdateTeamHandler extends CommandHandler<UpdateTeamCommand, AdminTeam> {
  public readonly commandType = MATCH_COMMAND.UPDATE_TEAM;

  private readonly deps: HandlerDependencies;

  public constructor(deps: HandlerDependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: UpdateTeamCommand): Promise<AdminTeam> {
    const { teamId, request, actor } = command;
    const current = await this.deps.catalogue.findTeam(teamId);

    if (current === undefined) throw new NotFoundError("team", teamId);

    const ratings = { ...toAdminTeam(current).ratings, ...definedOnly(request.ratings ?? {}) };
    const patch: TeamPatch = {
      ...(request.name === undefined ? {} : { name: request.name }),
      ...(request.shortName === undefined ? {} : { shortName: request.shortName }),
      ...(request.status === undefined ? {} : { status: request.status }),
      ...(request.ratings === undefined
        ? {}
        : {
            strength: overallStrength(ratings),
            attack: ratings.attack,
            midfield: ratings.midfield,
            defence: ratings.defence,
            goalkeeping: ratings.goalkeeper,
            pace: ratings.pace,
            finishing: ratings.finishing,
            form: ratings.form,
          }),
    };

    // A configuration change fails if its audit entry cannot be written: the audit call runs inside the update's
    // transaction, so a failure rolls the change back.
    const updated = await this.deps.catalogue.updateTeam(teamId, patch, async (before, after) => {
      try {
        await this.deps.identity.recordAudit({
          actorId: actor.id,
          actorRole: actor.role,
          action: "team_strength_changed",
          entityType: "team",
          entityId: teamId,
          before: toAdminTeam(before),
          after: toAdminTeam(after),
          severity: "NOTICE",
          requestId: actor.requestId,
        });
      } catch (error) {
        this.deps.logger.error("Team change rejected: audit entry not written", {
          event: "match.auditFailed",
          teamId,
          requestId: actor.requestId,
          error: error instanceof Error ? error.message : String(error),
        });

        throw new PeerFailedError(
          ErrorCodes.UPSTREAM_UNAVAILABLE,
          "The change was not applied because its audit entry could not be written.",
        );
      }
    });

    if (updated === undefined) throw new NotFoundError("team", teamId);

    return toAdminTeam(updated);
  }
}
