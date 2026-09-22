import { notificationChannelSchema, notificationTopicSchema } from "@betng/contracts";
import type { ChannelPreferences, NotificationChannel, NotificationTopic } from "@betng/contracts";

type Channels = ChannelPreferences["channels"];

const TOPICS: Readonly<Record<NotificationTopic, boolean>> = {
  bets: true,
  payments: true,
  security: true,
  kyc: true,
  limits: true,
  matches: false,
  marketing: false,
};

export const DEFAULT_CHANNELS: Channels = {
  email: { ...TOPICS },
  sms: { ...TOPICS, bets: false, kyc: false },
  push: { ...TOPICS, matches: true },
};

/** Security mail cannot be switched off. */
export const LOCKED_CHANNELS: readonly string[] = ["email.security"];

/** Unknown or malformed stored values fall back to the defaults key by key, and locked entries are always on. */
export function resolveChannels(stored: unknown): Channels {
  const source = typeof stored === "object" && stored !== null ? (stored as Record<string, unknown>) : {};

  const channel = (name: NotificationChannel): Record<NotificationTopic, boolean> => {
    const saved = source[name];
    const values = typeof saved === "object" && saved !== null ? (saved as Record<string, unknown>) : {};

    return Object.fromEntries(
      notificationTopicSchema.options.map((topic) => {
        const value = values[topic];

        return [topic, LOCKED_CHANNELS.includes(`${name}.${topic}`) || (typeof value === "boolean" ? value : DEFAULT_CHANNELS[name][topic])];
      }),
    ) as Record<NotificationTopic, boolean>;
  };

  return Object.fromEntries(notificationChannelSchema.options.map((name) => [name, channel(name)])) as unknown as Channels;
}
