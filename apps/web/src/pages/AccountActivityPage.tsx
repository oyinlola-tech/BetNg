import { useMemo } from "react";
import { Link } from "react-router";
import { Bell, Ticket, Wallet } from "lucide-react";
import { formatMoney, formatRelative, formatSignedMoney } from "@betng/ui-core";
import { ActivityFeed, Card, EmptyState, ProfileSkeleton, SectionHeading, statusTone, type ActivityItem } from "@betng/ui-web";
import { AccountErrorState } from "../features/auth";
import { usePageMeta } from "../features/seo";
import { transactionDescription } from "../features/wallet/transactionMeta";
import { RECENT_TRANSACTIONS_QUERY, useAccountSignals, useBets, useNotifications, useTransactionsPage } from "../hooks/accountQueries";

const PER_SOURCE = 8;
const SHOWN = 15;

interface Dated extends ActivityItem {
  readonly at: string;
}

export function AccountActivityPage(): React.JSX.Element {
  usePageMeta({ title: "Activity", noindex: true });
  useAccountSignals();

  const bets = useBets();
  const transactions = useTransactionsPage(RECENT_TRANSACTIONS_QUERY);
  const notifications = useNotifications();

  const items = useMemo(() => {
    const merged: Dated[] = [
      ...(bets.data ?? []).slice(0, PER_SOURCE).map((bet) => ({
        id: `bet-${bet.id}`,
        at: bet.settledAt ?? bet.placedAt,
        title: (
          <Link to={`/tickets/${bet.id}`} className="rounded-xs hover:text-brand focus-ring">
            Ticket {statusTone(bet.status).label.toLowerCase()}: {bet.legs[0]?.selectionLabel ?? "bet"}
            {bet.legs.length > 1 ? ` +${String(bet.legs.length - 1)}` : ""}
          </Link>
        ),
        detail: `Stake ${formatMoney(bet.stake)}`,
        time: formatRelative(bet.settledAt ?? bet.placedAt),
        tone: statusTone(bet.status).tone,
        icon: <Ticket />,
      })),
      ...(transactions.data?.items ?? []).slice(0, PER_SOURCE).map((t) => ({
        id: `transaction-${t.id}`,
        at: t.createdAt,
        title: transactionDescription(t),
        detail: formatSignedMoney(t.amount),
        time: formatRelative(t.createdAt),
        tone: "neutral" as const,
        icon: <Wallet />,
      })),
      ...(notifications.data ?? []).slice(0, PER_SOURCE).map((n) => ({
        id: `notification-${n.id}`,
        at: n.createdAt,
        title: n.title,
        detail: n.body,
        time: formatRelative(n.createdAt),
        tone: "info" as const,
        icon: <Bell />,
      })),
    ];

    return merged.sort((a, b) => b.at.localeCompare(a.at)).slice(0, SHOWN);
  }, [bets.data, transactions.data, notifications.data]);

  const loading = bets.data === undefined && transactions.data === undefined && notifications.data === undefined;
  const failed = bets.isError && transactions.isError && notifications.isError;

  if (loading && !failed) return <ProfileSkeleton fields={6} />;

  return (
    <Card padding="none">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <SectionHeading as="h2">Recent activity</SectionHeading>
        <span className="type-small text-text-muted">Tickets, wallet and alerts</span>
      </div>
      {failed ? (
        <AccountErrorState
          error={bets.error}
          onRetry={() => {
            void bets.refetch();
            void transactions.refetch();
            void notifications.refetch();
          }}
        />
      ) : items.length === 0 ? (
        <EmptyState compact title="No activity yet" description="Bets you place, wallet movements and alerts will be listed here." />
      ) : (
        <ActivityFeed items={items} />
      )}
    </Card>
  );
}
