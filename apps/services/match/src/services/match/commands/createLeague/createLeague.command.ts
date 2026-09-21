import { Command } from "@zudojs/cqrs";
import type { CreateLeagueRequest } from "../../../../dtos/index.js";
import type { CommandActor } from "../../match.dependencies.js";
import { MATCH_COMMAND } from "../../../../constants/index.js";

export class CreateLeagueCommand extends Command<"match.createLeague"> {
  public readonly request: CreateLeagueRequest;

  public readonly actor: CommandActor;

  public constructor(payload: {
    readonly request: CreateLeagueRequest;
    readonly actor: CommandActor;
  }) {
    super(MATCH_COMMAND.CREATE_LEAGUE);
    this.request = payload.request;
    this.actor = payload.actor;
  }
}
