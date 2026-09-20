import { useState } from "react";
import { Link } from "react-router";
import { Receipt } from "lucide-react";
import {
  formatDateTime,
  formatMoney,
  formatOdds,
  formatSignedMoney,
  type BetView,
} from "@betng/ui-core";
import {
  Badge,
  EmptyState,
  ErrorState,
  SectionHeader,
  SkeletonRows,
  Tabs,
} from "../components/ui";
import { MatchRow } from "../components/domain";
import { useBets, useTransactions, useViewedMatches } from "../hooks/queries";
import { cn } from "../lib/cn";

type Section = "BETS" | "VIEWED" | "TRANSACTIONS";

function statusTone(
  status: BetView["status"],
): "brand" | "success" | "muted" | "warning" {
  return status === "PENDING"
    ? "brand"
    : status === "WON"
      ? "success"
      : status === "VOID"
        ? "warning"
        : "muted";
}

export function BetCard({ bet }: { readonly bet: BetView }): React.JSX.Element {
  return (
    <article className="rounded-md border border-border bg-surface">
      <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Badge tone={statusTone(bet.status)} solid={bet.status === "WON"}>
            {bet.status}
          </Badge>
          <span className="text-sm text-text-muted">
            {bet.legs.length === 1
              ? "Single"
              : `${String(bet.legs.length)}-fold`}{" "}
            · {formatDateTime(bet.placedAt)}
          </span>
        </div>
        <span className="text-sm font-semibold tabular">
          @ {formatOdds(bet.totalOdds)}
        </span>
      </header>
      <ul className="divide-y divide-border">
        {bet.legs.map((leg) => (
          <li
            key={leg.selectionId}
            className="flex items-center gap-3 px-4 py-2.5"
          >
            <span
              className={cn(
                "size-2 shrink-0 rounded-full",
                leg.outcome === "WON" && "bg-success",
                leg.outcome === "LOST" && "bg-danger",
                leg.outcome === "PENDING" && "bg-brand",
                leg.outcome === "VOID" && "bg-warning",
              )}
              aria-label={leg.outcome}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold">
                {leg.selectionLabel}{" "}
                <span className="font-normal text-text-muted">
                  · {leg.marketName}
                </span>
              </p>
              <Link
                to={`/matches/${leg.matchId}`}
                className="truncate text-sm text-text-secondary hover:text-brand"
              >
                {leg.matchLabel}
                {leg.result !== undefined && ` · ${leg.result}`}
              </Link>
            </div>
            <span className="text-sm font-semibold tabular">
              {formatOdds(leg.odds)}
            </span>
          </li>
        ))}
      </ul>
      <footer className="flex items-center justify-between bg-surface-sunken/60 px-4 py-2.5 text-sm">
        <span className="text-text-secondary">
          Stake{" "}
          <span className="font-semibold tabular text-text-primary">
            {formatMoney(bet.stake)}
          </span>
        </span>
        <span className="text-text-secondary">
          {bet.status === "PENDING" ? "To return" : "Returned"}{" "}
          <span
            className={cn(
              "font-semibold tabular",
              bet.status === "WON" ? "text-success" : "text-text-primary",
            )}
          >
            {formatMoney(
              bet.status === "PENDING"
                ? bet.potentialPayout
                : (bet.payout ?? 0),
            )}
          </span>
        </span>
      </footer>
    </article>
  );
}

export function HistoryPage(): React.JSX.Element {
  const [section, setSection] = useState<Section>("BETS");
  const bets = useBets();
  const viewed = useViewedMatches();
  const transactions = useTransactions();

  return (
    <div className="space-y-5">
      <SectionHeader as="h1" eyebrow="Your activity" title="History" />
      <Tabs
        label="History section"
        value={section}
        onChange={setSection}
        items={[
          {
            value: "BETS",
            label: "Bets",
            ...(bets.data === undefined ? {} : { count: bets.data.length }),
          },
          { value: "VIEWED", label: "Watched" },
          { value: "TRANSACTIONS", label: "Transactions" },
        ]}
      />

      {section === "BETS" &&
        (bets.isPending ? (
          <SkeletonRows rows={6} />
        ) : bets.isError ? (
          <ErrorState error={bets.error} onRetry={() => void bets.refetch()} />
        ) : bets.data.length === 0 ? (
          <EmptyState
            icon={<Receipt className="size-5" />}
            title="No bets yet"
            description="Simulated bets you place appear here, and settle automatically at full time."
            action={
              <Link
                to="/virtuals"
                className="text-sm font-semibold text-brand hover:underline"
              >
                Open the lobby
              </Link>
            }
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {bets.data.map((b) => (
              <BetCard key={b.id} bet={b} />
            ))}
          </div>
        ))}

      {section === "VIEWED" && (
        <div className="divide-y divide-border rounded-md border border-border bg-surface">
          {viewed.isPending ? (
            <SkeletonRows rows={4} className="p-4" />
          ) : (viewed.data ?? []).length === 0 ? (
            <EmptyState
              compact
              title="Nothing watched yet"
              description="Matches you open are listed here."
            />
          ) : (
            viewed.data?.map((m) => (
              <MatchRow key={m.id} match={m} showLeague />
            ))
          )}
        </div>
      )}

      {section === "TRANSACTIONS" && (
        <div className="rounded-md border border-border bg-surface">
          {transactions.isPending ? (
            <SkeletonRows rows={6} className="p-4" />
          ) : transactions.isError ? (
            <ErrorState compact error={transactions.error} />
          ) : transactions.data.length === 0 ? (
            <EmptyState compact title="No transactions" />
          ) : (
            <ul className="divide-y divide-border">
              {transactions.data.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{t.description}</p>
                    <p className="text-xs text-text-muted">
                      {formatDateTime(t.createdAt)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "font-semibold tabular",
                      t.amount >= 0 ? "text-success" : "text-text-primary",
                    )}
                  >
                    {formatSignedMoney(t.amount)}
                  </span>
                  <span className="w-24 text-right tabular text-text-muted">
                    {formatMoney(t.balanceAfter)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
