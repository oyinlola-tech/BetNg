import { CommandHandler } from "@zudojs/cqrs";
import { MATCH_COMMAND } from "../../../../constants/index.js";
import type { AdminMatchDto } from "../../../../dtos/index.js";
import { MatchNotFoundError } from "../../../../errors/index.js";
import { toAdminMatch } from "../../../../models/index.js";
import type { HandlerDependencies } from "../../match.dependencies.js";
import type { PerformMatchActionCommand } from "./performMatchAction.command.js";

export class PerformMatchActionHandler extends CommandHandler<PerformMatchActionCommand, AdminMatchDto> {
  public readonly commandType = MATCH_COMMAND.PERFORM_MATCH_ACTION;

  private readonly deps: HandlerDependencies;

  public constructor(deps: HandlerDependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: PerformMatchActionCommand): Promise<AdminMatchDto> {
    const { matchId, request, actor } = command;
    const { lifecycle, matches } = this.deps;

    if ((await matches.findMatch(matchId)) === undefined) throw new MatchNotFoundError(matchId);

    switch (request.action) {
      case "OPEN_BETTING":
        await lifecycle.openBetting(matchId, actor, request.reason, actor.requestId);
        break;
      case "CLOSE_BETTING":
        await lifecycle.closeBetting(matchId, actor, request.reason, actor.requestId);
        break;
      case "START_SIMULATION":
        await lifecycle.startSimulation(matchId, actor, request.reason, actor.requestId, "START");
        break;
      case "RERUN_SIMULATION":
        await lifecycle.startSimulation(matchId, actor, request.reason, actor.requestId, "RERUN");
        break;
      case "VOID_MATCH":
        await lifecycle.voidMatch(matchId, actor, request.reason, actor.requestId);
        break;
    }

    const after = await matches.findMatch(matchId);

    if (after === undefined) throw new MatchNotFoundError(matchId);

    return toAdminMatch(after, await matches.listTransitions(matchId));
  }
}
