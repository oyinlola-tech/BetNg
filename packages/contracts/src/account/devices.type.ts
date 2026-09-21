import { z } from "@zudojs/validation";
import { isoTimestampSchema } from "../common/index.js";

// Pending backend: notification delivery. Email, SMS and push providers are configured server-side only.

export const notificationChannelSchema = z.enum(["email", "sms", "push"]);

export type NotificationChannel = z.infer<typeof notificationChannelSchema>;

export const notificationTopicSchema = z.enum(["bets", "payments", "security", "kyc", "limits", "matches", "marketing"]);

export type NotificationTopic = z.infer<typeof notificationTopicSchema>;

/** `security` cannot be switched off on every channel; the platform refuses that. */
export interface ChannelPreferences {
  readonly channels: Readonly<Record<NotificationChannel, Readonly<Record<NotificationTopic, boolean>>>>;
  /** Entries like `email.security`. */
  readonly locked: readonly string[];
}

const topics = z.object(Object.fromEntries(notificationTopicSchema.options.map((t) => [t, z.boolean()])) as Record<NotificationTopic, z.ZodBoolean>);

export const channelPreferencesSchema = z.object({
  channels: z.object({ email: topics, sms: topics, push: topics }),
  locked: z.array(z.string().regex(/^(email|sms|push)\.[a-z]+$/)),
});

export const pushPlatformSchema = z.enum(["web", "ios", "android"]);

export type PushPlatform = z.infer<typeof pushPlatformSchema>;

export interface PushDevice {
  readonly id: string;
  readonly platform: PushPlatform;
  readonly label: string;
  readonly current: boolean;
  readonly registeredAt: string;
  readonly lastSeenAt?: string | undefined;
}

export const pushDeviceSchema = z.object({
  id: z.string().min(1),
  platform: pushPlatformSchema,
  label: z.string().max(80),
  current: z.boolean(),
  registeredAt: isoTimestampSchema,
  lastSeenAt: isoTimestampSchema.optional(),
});

export const registerPushDeviceRequestSchema = z.object({
  platform: pushPlatformSchema,
  token: z.string().min(16).max(4096),
  label: z.string().max(80),
});

export type RegisterPushDeviceRequest = z.infer<typeof registerPushDeviceRequestSchema>;
