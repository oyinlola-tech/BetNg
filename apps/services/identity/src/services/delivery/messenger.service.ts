import type { NotificationKind, NotificationTopic } from "@betng/contracts";
import { NOTIFICATION } from "../../constants/index.js";
import type { Logger } from "@betng/service-kit";
import type {
  CustomerNotice,
  DeliveryProviders,
  IdentityStore,
  Messenger,
  SecurityAlert,
} from "../../interfaces/index.js";
import type { DataProtector } from "../../utils/index.js";
import { resolveChannels } from "../../utils/index.js";
import { DeliveryError } from "./deliveryError.js";
import { toInternationalNumber } from "./sms.provider.js";

const KIND_TOPIC: Readonly<Record<NotificationKind, NotificationTopic>> = {
  BET_SETTLED: "bets",
  BET_ACCEPTED: "bets",
  MATCH_STARTING: "matches",
  MATCH_FINISHED: "matches",
  RESULT_AVAILABLE: "matches",
  MATCH_EVENT: "matches",
  PAYMENT_UPDATED: "payments",
  KYC_UPDATED: "kyc",
  SECURITY_ALERT: "security",
  LIMIT_WARNING: "limits",
};

const ALERT_COPY: Readonly<Record<SecurityAlert["kind"], { readonly subject: string; readonly line: string }>> = {
  NEW_LOGIN: { subject: "New sign-in to your BetNG account", line: "Your account was just signed in to" },
  PASSWORD_CHANGED: { subject: "Your BetNG password was changed", line: "The password on your account was changed." },
  PASSWORD_RESET: { subject: "Your BetNG password was reset", line: "The password on your account was reset with a code sent to this address." },
  PROFILE_UPDATED: { subject: "Your BetNG profile was updated", line: "The name or phone number on your account was changed." },
  PASSWORD_RESET_SENT_BY_SUPPORT: {
    subject: "BetNG support sent you a password reset code",
    line: "A member of BetNG support sent a password reset code to this address. Your password stays the same unless the code is used.",
  },
  TWO_FACTOR_ENABLED: { subject: "Two-factor authentication is on", line: "Two-factor authentication was switched on for your account." },
  TWO_FACTOR_DISABLED: { subject: "Two-factor authentication is off", line: "Two-factor authentication was switched off for your account." },
  BACKUP_CODES_REGENERATED: { subject: "New BetNG backup codes", line: "New backup codes were generated; the previous set no longer works." },
  ACCOUNT_DELETION_REQUESTED: { subject: "Your BetNG account is scheduled for deletion", line: "Your account is scheduled for deletion." },
};

const NOT_YOU = "If this was not you, reset your password now and contact support.";

function alertText(alert: SecurityAlert, at: Date): { subject: string; line: string; text: string } {
  const copy = ALERT_COPY[alert.kind];
  let line = copy.line;

  if (alert.kind === "NEW_LOGIN") {
    const where = [alert.browser, alert.platform, alert.device].filter((part) => part !== undefined).join(" on ");

    line = `${line} ${where === "" ? "from a new device" : `from ${where}`} at ${at.toISOString()}.`;
  }

  if (alert.kind === "PROFILE_UPDATED" && alert.bySupport) {
    line = "BetNG support changed the name or phone number on your account.";
  }

  if (alert.kind === "ACCOUNT_DELETION_REQUESTED") {
    line = `${line} It will be deleted on ${alert.scheduledFor.toISOString().slice(0, 10)} unless you cancel it from your account settings.`;
  }

  return { subject: copy.subject, line, text: `${line}\n\n${NOT_YOU}\n` };
}

function stringData(data: Readonly<Record<string, unknown>> | undefined): Record<string, string> {
  return Object.fromEntries(
    Object.entries(data ?? {}).flatMap(([key, value]) =>
      typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? [[key, String(value)]] : [],
    ),
  );
}

export interface MessengerOptions {
  readonly providers: DeliveryProviders;
  readonly store: IdentityStore;
  readonly protector: DataProtector;
  readonly logger: Logger;
}

export function createMessenger(options: MessengerOptions): Messenger {
  const { providers, store, protector, logger } = options;

  const failed = (channel: string, error: unknown): void => {
    logger.warn("A message could not be delivered", {
      event: "message_delivery_failed",
      channel,
      provider: error instanceof DeliveryError ? error.provider : undefined,
      status: error instanceof DeliveryError ? error.status : undefined,
    });
  };

  const push = async (customerId: string, title: string, body: string, data: Record<string, string>): Promise<void> => {
    if (providers.push === undefined && providers.webPush === undefined) {
      return;
    }

    for (const device of await store.channels.listDevices(customerId)) {
      const provider = device.platform === "web" ? providers.webPush : providers.push;

      if (provider === undefined) {
        continue;
      }

      try {
        const token = protector.decrypt(device.tokenCiphertext, `push:${device.id}`);
        const outcome = await provider.send({ token, title, body, data });

        if (outcome === "unregistered") {
          await store.channels.removeByTokenHash(device.tokenHash);
        }
      } catch (error) {
        failed("push", error);
      }
    }
  };

  const deliver = async (
    customerId: string,
    topic: NotificationTopic,
    message: { readonly subject: string; readonly text: string; readonly data: Record<string, string> },
  ): Promise<void> => {
    const customer = await store.customers.findById(customerId);

    if (customer === undefined || customer.deletedAt !== null) {
      return;
    }

    const channels = resolveChannels((await store.channels.findPreferences(customerId))?.channels);
    const attempts: Promise<void>[] = [];

    if (channels.email[topic]) {
      attempts.push(providers.email.send({ to: customer.email, subject: message.subject, text: message.text }).catch((error: unknown) => failed("email", error)));
    }

    const phone = toInternationalNumber(customer.phone);

    if (channels.sms[topic] && providers.sms !== undefined && phone !== undefined) {
      attempts.push(providers.sms.send({ to: phone, text: `${message.subject}. ${message.text}`.slice(0, 300) }).catch((error: unknown) => failed("sms", error)));
    }

    if (channels.push[topic]) {
      attempts.push(push(customerId, message.subject, message.text.split("\n")[0] ?? message.subject, message.data));
    }

    await Promise.all(attempts);
  };

  const storeNotice = async (customerId: string, notice: CustomerNotice, dedupeKey: string | undefined): Promise<boolean> => {
    const { duplicate } = await store.notifications.createOnce({
      customerId,
      kind: notice.kind,
      title: notice.title.slice(0, NOTIFICATION.TITLE_MAX),
      body: notice.body.slice(0, NOTIFICATION.BODY_MAX),
      data: notice.data,
      dedupeKey,
    });

    return !duplicate;
  };

  const fanOut = async (customerId: string, notice: CustomerNotice): Promise<void> => {
    try {
      await deliver(customerId, KIND_TOPIC[notice.kind], {
        subject: notice.title,
        text: notice.body === "" ? notice.title : notice.body,
        data: { kind: notice.kind, ...stringData(notice.data) },
      });
    } catch (error) {
      failed("notification", error);
    }
  };

  return {
    sendCode: async (to, purpose, code, expiresAt) => {
      const minutes = Math.max(1, Math.round((expiresAt.getTime() - Date.now()) / 60_000));
      const subject = purpose === "verification" ? "Your BetNG verification code" : "Your BetNG password reset code";
      const intro = purpose === "verification" ? "Use this code to verify your email address:" : "Use this code to reset your password:";

      await providers.email.send({
        to,
        subject,
        text: `${intro}\n\n${code}\n\nIt expires in ${String(minutes)} minutes. BetNG will never ask you for this code.\nIf you did not ask for it, you can ignore this email.\n`,
      });
    },

    securityAlert: async (customerId, alert) => {
      try {
        const { subject, line, text } = alertText(alert, new Date());

        await storeNotice(customerId, { kind: "SECURITY_ALERT", title: subject, body: line, data: { alert: alert.kind } }, undefined);
        await deliver(customerId, "security", { subject, text, data: { kind: "SECURITY_ALERT", alert: alert.kind } });
      } catch (error) {
        failed("security_alert", error);
      }
    },

    fanOut,

    notice: async (customerId, notice) => {
      try {
        if (await storeNotice(customerId, notice, notice.dedupeKey)) {
          await fanOut(customerId, notice);
        }
      } catch (error) {
        failed("notice", error);
      }
    },
  };
}
