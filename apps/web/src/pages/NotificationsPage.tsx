import { useMemo } from "react";
import { Link } from "react-router";
import { CheckCheck } from "lucide-react";
import { formatRelative, formatShortDate, toLocalDateKey, type NotificationView } from "@betng/ui-core";
import { Button, Card, EmptyState, SectionHeader, SectionHeading, SkeletonRows, cn, presentError, useToast } from "@betng/ui-web";
import { AccountErrorState } from "../features/auth";
import { GROUP_LABELS, NotificationIcon, notificationGroup, notificationTarget, notificationTone } from "../features/notifications/notificationMeta";
import { usePageMeta } from "../features/seo";
import { useAccountSignals, useMarkNotificationsRead, useNotifications } from "../hooks/accountQueries";

interface DayGroup {
  readonly key: string;
  readonly label: string;
  readonly items: readonly NotificationView[];
}

function groupByDay(items: readonly NotificationView[]): readonly DayGroup[] {
  const today = toLocalDateKey(new Date());
  const groups = new Map<string, NotificationView[]>();

  for (const item of items) {
    const key = toLocalDateKey(new Date(item.createdAt));
    const list = groups.get(key);

    if (list === undefined) groups.set(key, [item]);
    else list.push(item);
  }

  return [...groups.entries()].map(([key, list]) => ({
    key,
    label: key === today ? "Today" : formatShortDate(list[0]?.createdAt ?? key),
    items: list,
  }));
}

function NotificationRow({ notification, onOpen }: { readonly notification: NotificationView; readonly onOpen: (notification: NotificationView) => void }): React.JSX.Element {
  const to = notificationTarget(notification);
  const content = (
    <>
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-md", notification.read ? "bg-surface-sunken text-text-muted" : notificationTone(notification.kind) === "warning" ? "bg-warning-subtle text-warning" : "bg-brand-subtle text-brand")}>
        <NotificationIcon notification={notification} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className={cn("type-body min-w-0 truncate", notification.read ? "font-medium text-text-secondary" : "font-semibold text-text-primary")}>{notification.title}</span>
          {!notification.read && <span className="type-caption shrink-0 rounded-xs bg-brand-subtle px-1 text-brand">New</span>}
        </span>
        <span className="type-small line-clamp-2 text-text-muted">{notification.body}</span>
        <span className="type-small mt-0.5 block text-text-muted">
          {GROUP_LABELS[notificationGroup(notification.kind)]} · {formatRelative(notification.createdAt)}
        </span>
      </span>
    </>
  );

  if (to !== undefined) {
    return (
      <Link
        to={to}
        onClick={() => {
          onOpen(notification);
        }}
        className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-hover focus-ring"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      {content}
      {!notification.read && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onOpen(notification);
          }}
        >
          Mark read
        </Button>
      )}
    </div>
  );
}

export function NotificationsPage(): React.JSX.Element {
  usePageMeta({ title: "Notifications", noindex: true });
  useAccountSignals();

  const notifications = useNotifications();
  const markRead = useMarkNotificationsRead();
  const { toast } = useToast();
  const unread = notifications.data?.filter((n) => !n.read).length ?? 0;
  const days = useMemo(() => groupByDay(notifications.data ?? []), [notifications.data]);

  const failed = (error: unknown): void => {
    toast({ tone: "danger", title: "Not marked as read", message: presentError(error).message });
  };

  const open = (notification: NotificationView): void => {
    if (!notification.read) markRead.mutate([notification.id], { onError: failed });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <SectionHeader
        as="h1"
        eyebrow={notifications.data === undefined ? "Alerts" : unread > 0 ? `${String(unread)} unread` : "All read"}
        title="Notifications"
        aside={
          <div className="flex items-center gap-2">
            <Link to="/account/notifications" className="type-small rounded-xs font-semibold text-brand hover:underline focus-ring">
              Preferences
            </Link>
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={<CheckCheck className="size-3.5" aria-hidden />}
              disabled={unread === 0}
              loading={markRead.isPending && markRead.variables === undefined}
              onClick={() => {
                markRead.mutate(undefined, { onError: failed });
              }}
            >
              Mark all read
            </Button>
          </div>
        }
      />
      {notifications.data === undefined ? (
        <Card padding="none">
          {notifications.isError ? (
            <AccountErrorState error={notifications.error} onRetry={() => void notifications.refetch()} />
          ) : (
            <SkeletonRows rows={6} className="p-4" />
          )}
        </Card>
      ) : notifications.data.length === 0 ? (
        <Card padding="none">
          <EmptyState preset="noNotifications" />
        </Card>
      ) : (
        days.map((day) => (
          <section key={day.key} aria-labelledby={`day-${day.key}`} className="space-y-2">
            <SectionHeading as="h2" id={`day-${day.key}`}>
              {day.label}
            </SectionHeading>
            <Card padding="none">
              <ul className="divide-y divide-border">
                {day.items.map((notification) => (
                  <li key={notification.id}>
                    <NotificationRow notification={notification} onOpen={open} />
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        ))
      )}
    </div>
  );
}
