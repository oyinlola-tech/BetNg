import { Command } from "@zudojs/cqrs";
import type { LiveEventType } from "@betng/contracts";
import { EVENT_COMMAND } from "../../../../constants/index.js";

/**
 * Asks for one live event to be pushed to a match's subscribers.
 *
 * Raised only from inside the platform — by the match service, relaying what
 * the simulation decided. There is no client frame that produces one.
 */
export class PublishEventCommand extends Command<"event.publishEvent"> {
  public readonly matchId: string;

  public readonly type_: LiveEventType;

  public readonly minute: number;

  public readonly side: "HOME" | "AWAY" | undefined;

  public readonly score: { readonly home: number; readonly away: number };

  public readonly description: string;

  public constructor(payload: {
    readonly matchId: string;
    readonly type: LiveEventType;
    readonly minute: number;
    readonly side?: "HOME" | "AWAY";
    readonly score: { readonly home: number; readonly away: number };
    readonly description: string;
  }) {
    super(EVENT_COMMAND.PUBLISH_EVENT);
    this.matchId = payload.matchId;
    this.type_ = payload.type;
    this.minute = payload.minute;
    this.side = payload.side;
    this.score = payload.score;
    this.description = payload.description;
  }
}
