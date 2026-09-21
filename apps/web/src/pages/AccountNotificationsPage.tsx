import type { NotificationPreferences } from "@betng/ui-core";
import { Card, FormError, ProfileSkeleton, SectionHeading, Switch } from "@betng/ui-web";
import { AccountErrorState } from "../features/auth";
import { usePageMeta } from "../features/seo";
import { useNotificationPreferences, useSetNotificationPreferences } from "../hooks/accountQueries";

const OPTIONS: readonly { readonly key: keyof NotificationPreferences; readonly label: string; readonly description: string }[] = [
  { key: "matchStarting", label: "Match starting", description: "When a match you follow is about to kick off" },
  { key: "matchFinished", label: "Full time", description: "Final scores for matches you follow" },
  { key: "betSettled", label: "Bet settled", description: "When the platform settles one of your bets" },
  { key: "goals", label: "Goals", description: "Every goal in matches you are watching" },
];

export function AccountNotificationsPage(): React.JSX.Element {
  usePageMeta({ title: "Notification preferences", noindex: true });

  const preferences = useNotificationPreferences();
  const save = useSetNotificationPreferences();

  if (preferences.data === undefined) {
    return preferences.isError ? (
      <Card padding="none">
        <AccountErrorState error={preferences.error} onRetry={() => void preferences.refetch()} />
      </Card>
    ) : (
      <ProfileSkeleton fields={4} />
    );
  }

  const current = preferences.data;

  return (
    <Card>
      <SectionHeading as="h2">Notifications</SectionHeading>
      <p className="type-small mt-2 text-text-muted">Choose which in-app alerts your account receives.</p>
      <FormError error={save.error} className="mt-3" />
      <div className="mt-2 divide-y divide-border">
        {OPTIONS.map((option) => (
          <Switch
            key={option.key}
            label={option.label}
            description={option.description}
            checked={current[option.key]}
            disabled={save.isPending}
            onChange={(checked) => {
              save.mutate({ ...current, [option.key]: checked });
            }}
          />
        ))}
      </div>
    </Card>
  );
}
