import { CommandHandler } from "@zudojs/cqrs";
import { asId, matchChannel } from "@betng/contracts";
import type { LiveEvent } from "@betng/contracts";
import type { Logger } from "@betng/service-kit";
import { EVENT_COMMAND } from "../../../../constants/index.js";
import type { ChannelRegistry } from "../../../../interfaces/index.js";
import type { PublishEventCommand } from "./publishEvent.command.js";

export interface PublishResult {
  readonly event: LiveEvent;
  readonly delivered: number;
}

/**
 * Pushes one live event to a match's subscribers.
 *
 * The sequence is assigned here, by the registry, rather than supplied by the
 * caller: two publishers must not be able to hand out the same number, or a
 * client's gap detection stops meaning anything.
 *
 * Delivery is best-effort and deliberately so. The stream is a projection of
 * what the match service already recorded; a subscriber that misses a frame
 * re-reads the match and is correct again. Blocking the simulation on a slow
 * TV client would be the wrong trade.
 */
export class PublishEventHandler extends CommandHandler<
  PublishEventCommand,
  PublishResult
> {
  public readonly commandType = EVENT_COMMAND.PUBLISH_EVENT;

  private readonly channels: ChannelRegistry;

  private readonly logger: Logger;

  private readonly now: () => Date;

  public constructor(
    channels: ChannelRegistry,
    logger: Logger,
    now: () => Date = () => new Date(),
  ) {
    super();
    this.channels = channels;
    this.logger = logger;
    this.now = now;
  }

  public async execute(command: PublishEventCommand): Promise<PublishResult> {
    const channel = matchChannel(command.matchId);

    const event: LiveEvent = {
      matchId: asId<"MatchId">(command.matchId),
      sequence: this.channels.nextSequence(channel),
      type: command.type_,
      minute: command.minute,
      ...(command.side === undefined ? {} : { side: command.side }),
      score: command.score,
      description: command.description,
      occurredAt: this.now().toISOString(),
    };

    const frame = JSON.stringify({ type: "EVENT", channel, event });
    const subscribers = this.channels.subscribers(channel);

    for (const session of subscribers) {
      session.send(frame);
    }

    this.logger.debug("Live event published", {
      channel,
      sequence: event.sequence,
      type: event.type,
      delivered: subscribers.length,
    });

    return { event, delivered: subscribers.length };
  }
}
