export interface SubscriptionManager {
  /** True when this is the first holder, so the channel has to be requested. */
  readonly add: (channel: string) => boolean;
  /** True when the last holder left, so the channel can be released. */
  readonly remove: (channel: string) => boolean;
  readonly channels: () => readonly string[];
  readonly has: (channel: string) => boolean;
  readonly clear: () => void;
}

export function createSubscriptionManager(): SubscriptionManager {
  const holders = new Map<string, number>();

  return {
    add: (channel) => {
      const count = holders.get(channel) ?? 0;

      holders.set(channel, count + 1);

      return count === 0;
    },
    remove: (channel) => {
      const count = holders.get(channel) ?? 0;

      if (count <= 1) {
        holders.delete(channel);

        return count === 1;
      }

      holders.set(channel, count - 1);

      return false;
    },
    channels: () => [...holders.keys()],
    has: (channel) => holders.has(channel),
    clear: () => {
      holders.clear();
    },
  };
}
