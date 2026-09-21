import { Command } from "@zudojs/cqrs";
import type { CreateTeamRequest } from "../../../../dtos/index.js";
import type { CommandActor } from "../../match.dependencies.js";
import { MATCH_COMMAND } from "../../../../constants/index.js";

export class CreateTeamCommand extends Command<"match.createTeam"> {
  public readonly request: CreateTeamRequest;

  public readonly actor: CommandActor;

  public constructor(payload: {
    readonly request: CreateTeamRequest;
    readonly actor: CommandActor;
  }) {
    super(MATCH_COMMAND.CREATE_TEAM);
    this.request = payload.request;
    this.actor = payload.actor;
  }
}
