import type { ChannelPreferences, NotificationChannel, NotificationTopic } from "@betng/contracts";
import { Card, FormError, SectionHeading, SkeletonRows, useFlag } from "@betng/ui-web";
import { AccountErrorState } from "../auth/AccountErrorState";
import { isNotImplemented, useChannelPreferences, useSetChannelPreferences } from "./queries";
import { Unavailable } from "./Unavailable";

const CHANNELS: readonly { readonly key: NotificationChannel; readonly label: string }[] = [
  { key: "email", label: "Email" },
  { key: "sms", label: "SMS" },
  { key: "push", label: "Push" },
];

const TOPICS: readonly { readonly key: NotificationTopic; readonly label: string; readonly description: string }[] = [
  { key: "bets", label: "Bets", description: "Accepted and settled bets" },
  { key: "payments", label: "Payments", description: "Deposits and withdrawals" },
  { key: "security", label: "Security", description: "Sign-ins, password and two-step changes" },
  { key: "kyc", label: "Verification", description: "Identity check updates" },
  { key: "limits", label: "Limits", description: "Spending limits and warnings" },
  { key: "matches", label: "Matches", description: "Kick-offs and results you follow" },
  { key: "marketing", label: "News and offers", description: "Product news from BETNG" },
];

export function ChannelMatrix(): React.JSX.Element {
  const enabled = useFlag("notificationChannelsEnabled");
  const preferences = useChannelPreferences(enabled);
  const save = useSetChannelPreferences();

  if (!enabled || isNotImplemented(preferences.error)) {
    return (
      <Card padding="none">
        <div className="border-b border-border px-4 py-3">
          <SectionHeading as="h2">Email, SMS and push</SectionHeading>
        </div>
        <Unavailable title="Not available yet" description="Choosing how the platform contacts you outside the app is not offered yet." />
      </Card>
    );
  }

  if (preferences.data === undefined) {
    return (
      <Card padding="none">
        {preferences.isError ? <AccountErrorState error={preferences.error} onRetry={() => void preferences.refetch()} /> : <SkeletonRows rows={5} className="p-4" />}
      </Card>
    );
  }

  const current: ChannelPreferences = preferences.data;
  const locked = new Set(current.locked);
  const toggle = (channel: NotificationChannel, topic: NotificationTopic, value: boolean): void => {
    save.mutate({ ...current.channels, [channel]: { ...current.channels[channel], [topic]: value } });
  };

  return (
    <Card padding="none">
      <div className="border-b border-border px-4 py-3">
        <SectionHeading as="h2">Email, SMS and push</SectionHeading>
        <p className="type-small mt-1 text-text-muted">Choose how the platform reaches you for each kind of message.</p>
      </div>
      <FormError error={save.error} className="mx-4 mt-3" />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[26rem] text-left">
          <caption className="sr-only">Notification channels by topic</caption>
          <thead className="bg-surface-sunken">
            <tr>
              <th scope="col" className="type-caption px-4 py-2">
                Topic
              </th>
              {CHANNELS.map((channel) => (
                <th key={channel.key} scope="col" className="type-caption w-20 px-2 py-2 text-center">
                  {channel.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {TOPICS.map((topic) => (
              <tr key={topic.key}>
                <th scope="row" className="px-4 py-2.5 font-normal">
                  <span className="type-body block font-medium text-text-primary">{topic.label}</span>
                  <span className="type-small block text-text-muted">{topic.description}</span>
                </th>
                {CHANNELS.map((channel) => {
                  const isLocked = locked.has(`${channel.key}.${topic.key}`);
                  const checked = current.channels[channel.key][topic.key];

                  return (
                    <td key={channel.key} className="px-2 py-2.5 text-center">
                      <input
                        type="checkbox"
                        className="size-4.5 accent-brand focus-ring disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label={`${topic.label} by ${channel.label}${isLocked ? ", required" : ""}`}
                        title={isLocked ? "Required for your account's security; it cannot be switched off." : undefined}
                        checked={checked}
                        disabled={isLocked || save.isPending}
                        onChange={(event) => {
                          toggle(channel.key, topic.key, event.target.checked);
                        }}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {current.locked.length > 0 && (
        <p className="type-small border-t border-border px-4 py-3 text-text-muted">Greyed-out choices are required by the platform, for example security messages by email, and cannot be switched off.</p>
      )}
    </Card>
  );
}
