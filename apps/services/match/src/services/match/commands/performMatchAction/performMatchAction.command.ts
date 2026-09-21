import { Command } from "@zudojs/cqrs";
import type { MatchAdminActionRequest } from "@betng/contracts";
import type { CommandActor } from "../../match.dependencies.js";
import { MATCH_COMMAND } from "../../../../constants/index.js";

export class PerformMatchActionCommand extends Command<"match.performMatchAction"> {
  public readonly matchId: string;

  public readonly request: MatchAdminActionRequest;

  public readonly actor: CommandActor;

  public constructor(payload: {
    readonly matchId: string;
    readonly request: MatchAdminActionRequest;
    readonly actor: CommandActor;
  }) {
    super(MATCH_COMMAND.PERFORM_MATCH_ACTION);
    this.matchId = payload.matchId;
    this.request = payload.request;
    this.actor = payload.actor;
  }
}
