import { CommandHandler } from "@zudojs/cqrs";
import { EVENT_COMMAND } from "../../../../constants/index.js";
import type { ChannelRegistry } from "../../../../interfaces/index.js";
import type { PublishSignalCommand } from "./publishSignal.command.js";

export interface SignalResult {
  readonly sequence: number;
  readonly delivered: number;
}

export class PublishSignalHandler extends CommandHandler<PublishSignalCommand, SignalResult> {
  public readonly commandType = EVENT_COMMAND.PUBLISH_SIGNAL;

  private readonly channels: ChannelRegistry;

  private readonly now: () => Date;

  public constructor(channels: ChannelRegistry, now: () => Date = () => new Date()) {
    super();
    this.channels = channels;
    this.now = now;
  }

  public execute(command: PublishSignalCommand): Promise<SignalResult> {
    const subscribers = this.channels.subscribers(command.channel);

    if (subscribers.length === 0) return Promise.resolve({ sequence: 0, delivered: 0 });

    const sequence = this.channels.nextSequence(command.channel);
    const frame = JSON.stringify({
      type: "EVENT",
      channel: command.channel,
      event: {
        type: command.signal,
        sequence,
        occurredAt: this.now().toISOString(),
        ...(command.hint === undefined ? {} : { payload: command.hint }),
      },
    });

    for (const session of subscribers) session.send(frame);

    return Promise.resolve({ sequence, delivered: subscribers.length });
  }
}
