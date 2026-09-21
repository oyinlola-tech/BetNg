import { Command } from "@zudojs/cqrs";
import type { UpdateTeamRequest } from "@betng/contracts";
import type { CommandActor } from "../../match.dependencies.js";
import { MATCH_COMMAND } from "../../../../constants/index.js";

export class UpdateTeamCommand extends Command<"match.updateTeam"> {
  public readonly teamId: string;

  public readonly request: UpdateTeamRequest;

  public readonly actor: CommandActor;

  public constructor(payload: {
    readonly teamId: string;
    readonly request: UpdateTeamRequest;
    readonly actor: CommandActor;
  }) {
    super(MATCH_COMMAND.UPDATE_TEAM);
    this.teamId = payload.teamId;
    this.request = payload.request;
    this.actor = payload.actor;
  }
}
