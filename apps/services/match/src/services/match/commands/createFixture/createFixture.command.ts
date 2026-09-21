import { Command } from "@zudojs/cqrs";
import type { CreateFixtureRequest } from "../../../../dtos/index.js";
import type { CommandActor } from "../../match.dependencies.js";
import { MATCH_COMMAND } from "../../../../constants/index.js";

export class CreateFixtureCommand extends Command<"match.createFixture"> {
  public readonly request: CreateFixtureRequest;

  public readonly actor: CommandActor;

  public constructor(payload: {
    readonly request: CreateFixtureRequest;
    readonly actor: CommandActor;
  }) {
    super(MATCH_COMMAND.CREATE_FIXTURE);
    this.request = payload.request;
    this.actor = payload.actor;
  }
}
