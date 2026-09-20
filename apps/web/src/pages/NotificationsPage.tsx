import { Link } from "react-router";
import { Bell, CheckCheck, Goal, Receipt, Timer, Trophy } from "lucide-react";
import { formatRelative, type NotificationKind } from "@betng/ui-core";
import {
  Button,
  EmptyState,
  ErrorState,
  SectionHeader,
  SkeletonRows,
} from "../components/ui";
import { useMarkNotificationsRead, useNotifications } from "../hooks/queries";
import { cn } from "../lib/cn";

const ICONS: Record<
  NotificationKind,
  React.ComponentType<{ className?: string }>
> = {
  MATCH_STARTING: Timer,
  MATCH_FINISHED: Trophy,
  RESULT_AVAILABLE: Trophy,
  BET_SETTLED: Receipt,
  MATCH_EVENT: Goal,
};

export function NotificationsPage(): React.JSX.Element {
  const notifications = useNotifications();
  const markRead = useMarkNotificationsRead();
  const unread = notifications.data?.filter((n) => !n.read).length ?? 0;

  return (
    <div className="space-y-5">
      <SectionHeader
        as="h1"
        eyebrow={unread > 0 ? `${String(unread)} unread` : "All caught up"}
        title="Notifications"
        aside={
          <Button
            variant="secondary"
            size="sm"
            icon={<CheckCheck className="size-3.5" />}
            disabled={unread === 0}
            loading={markRead.isPending}
            onClick={() => {
              markRead.mutate(undefined);
            }}
          >
            Mark all read
          </Button>
        }
      />
      <div className="rounded-md border border-border bg-surface">
        {notifications.isPending ? (
          <SkeletonRows rows={5} className="p-4" />
        ) : notifications.isError ? (
          <ErrorState
            compact
            error={notifications.error}
            onRetry={() => void notifications.refetch()}
          />
        ) : notifications.data.length === 0 ? (
          <EmptyState
            icon={<Bell className="size-5" />}
            title="No notifications"
            description="Kick-offs, full-time results and settled bets for matches you follow will show up here."
          />
        ) : (
          <ul className="divide-y divide-border">
            {notifications.data.map((n) => {
              const Icon = ICONS[n.kind];
              const to =
                n.matchId !== undefined
                  ? `/matches/${n.matchId}`
                  : n.betId !== undefined
                    ? "/history"
                    : undefined;
              const body = (
                <>
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-md",
                      n.read
                        ? "bg-surface-sunken text-text-muted"
                        : "bg-brand-subtle text-brand",
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate text-base",
                        n.read
                          ? "font-medium text-text-secondary"
                          : "font-semibold text-text-primary",
                      )}
                    >
                      {n.title}
                    </span>
                    <span className="block truncate text-sm text-text-muted">
                      {n.body}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-text-muted">
                    {formatRelative(n.createdAt)}
                  </span>
                  {!n.read && (
                    <span
                      aria-label="Unread"
                      className="size-2 shrink-0 rounded-full bg-brand"
                    />
                  )}
                </>
              );

              return (
                <li key={n.id}>
                  {to === undefined ? (
                    <div className="flex items-center gap-3 px-4 py-3">
                      {body}
                    </div>
                  ) : (
                    <Link
                      to={to}
                      onClick={() => {
                        if (!n.read) markRead.mutate([n.id]);
                      }}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-surface-hover focus-ring"
                    >
                      {body}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
