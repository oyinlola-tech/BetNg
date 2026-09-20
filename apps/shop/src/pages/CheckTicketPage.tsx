import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Ban, CircleCheckBig, CircleDashed, CircleSlash, CircleX, Clock, HandCoins, SearchX, TimerOff } from "lucide-react";
import type { Ticket } from "@betng/contracts";
import { DataSourceError, formatDateTime, formatMoney } from "@betng/ui-core";
import { Button, ErrorState, LoadingState, cn } from "@betng/ui-web";
import { Guard } from "../components/Guard";
import { PageHeader } from "../components/PageHeader";
import { TicketLookup } from "../components/TicketLookup";
import { TicketReceipt } from "../components/TicketReceipt";
import { useTicket } from "../hooks/queries";
import { useShopSession } from "../hooks/useShopSession";
import { verdictFor, type CheckVerdict } from "../lib/ticket";

const VERDICT: Readonly<Record<CheckVerdict | "NOT_FOUND", { readonly word: string; readonly band: string; readonly icon: React.ReactNode }>> = {
  WINNING: { word: "Winning", band: "bg-success text-white", icon: <CircleCheckBig aria-hidden /> },
  LOSING: { word: "Losing", band: "bg-danger text-white", icon: <CircleX aria-hidden /> },
  OPEN: { word: "Open", band: "bg-brand text-text-on-brand", icon: <CircleDashed aria-hidden /> },
  VOID: { word: "Void", band: "bg-warning text-white", icon: <CircleSlash aria-hidden /> },
  ALREADY_PAID: { word: "Already paid", band: "bg-text-primary text-background", icon: <HandCoins aria-hidden /> },
  CANCELLED: { word: "Cancelled", band: "bg-text-secondary text-background", icon: <Ban aria-hidden /> },
  EXPIRED: { word: "Expired", band: "bg-text-secondary text-background", icon: <TimerOff aria-hidden /> },
  NOT_FOUND: { word: "Not found", band: "bg-surface-sunken text-text-primary border-2 border-dashed border-border-strong", icon: <SearchX aria-hidden /> },
};

function detail(ticket: Ticket): string {
  switch (verdictFor(ticket)) {
    case "WINNING":
      return `Pays ${formatMoney(ticket.payout ?? ticket.potentialPayout)}. Collect by ${formatDateTime(ticket.expiresAt)}.`;
    case "LOSING":
      return "At least one selection lost. Nothing to pay.";
    case "OPEN": {
      const pending = ticket.selections.filter((s) => s.outcome === "PENDING").length;

      return `${String(pending)} of ${String(ticket.selections.length)} selection${ticket.selections.length === 1 ? "" : "s"} still to finish. Would pay ${formatMoney(ticket.potentialPayout)}.`;
    }
    case "VOID":
      return `Ticket voided. Refund the stake of ${formatMoney(ticket.stake)}.`;
    case "ALREADY_PAID":
      return `${formatMoney(ticket.payout ?? 0)} was paid${ticket.paidAt === undefined ? "" : ` on ${formatDateTime(ticket.paidAt)}`}. Do not pay again.`;
    case "CANCELLED":
      return "Cancelled at the counter. The stake was returned.";
    case "EXPIRED":
      return `The collection window closed on ${formatDateTime(ticket.expiresAt)}. Refer the customer to the manager.`;
  }
}

function Band({ verdict, code, children }: { readonly verdict: CheckVerdict | "NOT_FOUND"; readonly code: string; readonly children: React.ReactNode }): React.JSX.Element {
  const v = VERDICT[verdict];

  return (
    <div role="status" aria-live="assertive" className={cn("flex flex-wrap items-center gap-x-5 gap-y-2 rounded-md px-6 py-5", v.band)}>
      <span className="[&>svg]:size-12">{v.icon}</span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-4xl font-bold uppercase leading-none tracking-tight">{v.word}</p>
        <p className="mt-1.5 text-md opacity-90">{children}</p>
      </div>
      <p className="font-mono text-xl font-semibold tracking-wider opacity-90">{code}</p>
    </div>
  );
}

function CheckTicket(): React.JSX.Element {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { can } = useShopSession();
  const [code, setCode] = useState(params.get("code") ?? "");
  const ticket = useTicket(code === "" ? undefined : code);
  const notFound = ticket.error instanceof DataSourceError && ticket.error.code === "NOT_FOUND";

  return (
    <div className="mx-auto max-w-4xl p-4 lg:p-6">
      <PageHeader title="Check Ticket" description="Shows the state of any ticket sold at this shop." />
      <TicketLookup
        label="Ticket number"
        actionLabel="Check"
        initial={code}
        busy={ticket.isFetching}
        onSubmit={(next) => {
          setCode(next);
          setParams({ code: next }, { replace: true });
          if (next === code) void ticket.refetch();
        }}
      />

      <div className="mt-6">
        {code === "" ? (
          <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border-strong py-14 text-center text-text-muted">
            <Clock className="size-6" aria-hidden />
            <p className="text-md font-medium text-text-secondary">Waiting for a ticket</p>
            <p className="text-sm">The result appears here the moment an ID is entered or scanned.</p>
          </div>
        ) : ticket.isPending ? (
          <LoadingState label={`Checking ${code}`} />
        ) : notFound ? (
          <Band verdict="NOT_FOUND" code={code}>
            No ticket with this ID was sold at this shop. Check each character, or ask where it was bought.
          </Band>
        ) : ticket.isError ? (
          <ErrorState error={ticket.error} onRetry={() => void ticket.refetch()} />
        ) : (
          <div className="space-y-5">
            <Band verdict={verdictFor(ticket.data)} code={ticket.data.code}>
              {detail(ticket.data)}
            </Band>
            <div className="grid gap-5 md:grid-cols-[auto_minmax(0,1fr)]">
              <TicketReceipt ticket={ticket.data} />
              <div className="space-y-2">
                {(ticket.data.status === "WON" || ticket.data.status === "VOID") && can("tickets:payout") && (
                  <Button size="lg" full icon={<HandCoins className="size-4" />} onClick={() => void navigate(`/cashier/payout?code=${ticket.data.code}`)}>
                    {ticket.data.status === "VOID" ? `Refund ${formatMoney(ticket.data.stake)}` : `Pay out ${formatMoney(ticket.data.payout ?? ticket.data.potentialPayout)}`}
                  </Button>
                )}
                <Button size="lg" full variant="secondary" onClick={() => void navigate(`/tickets/${ticket.data.code}`)}>
                  Open ticket
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function CheckTicketPage(): React.JSX.Element {
  return (
    <Guard permission="tickets:check">
      <CheckTicket />
    </Guard>
  );
}
