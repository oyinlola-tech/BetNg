import { getTicketPrinter } from "../services/ticketPrinter";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, HandCoins, Printer, ShieldAlert } from "lucide-react";
import type { Ticket } from "@betng/contracts";
import { DataSourceError, formatDateTime, formatMoney } from "@betng/ui-core";
import { Button, CodeInput, ErrorState, LoadingState, Modal, Panel, presentError, useToast } from "@betng/ui-web";
import { Guard } from "../components/Guard";
import { PageHeader } from "../components/PageHeader";
import { TicketLookup } from "../components/TicketLookup";
import { TicketReceipt } from "../components/TicketReceipt";
import { usePayoutTicket, useTicket } from "../hooks/queries";
import { queryKeys } from "../lib/queryKeys";
import { TICKET_STATUS, isPayable } from "../lib/ticket";

function Blocked({ ticket }: { readonly ticket: Ticket }): React.JSX.Element {
  const reason =
    ticket.status === "PAID"
      ? `This ticket was already paid${ticket.paidAt === undefined ? "" : ` on ${formatDateTime(ticket.paidAt)}`}. Do not pay it again.`
      : ticket.status === "OPEN"
        ? "Not every match on this ticket has finished. It can be paid once it settles as won."
        : `${TICKET_STATUS[ticket.status].description} There is nothing to pay.`;

  return (
    <div role="status" className="flex items-start gap-3 rounded-md border border-border bg-surface-sunken p-4">
      <ShieldAlert className="mt-0.5 size-5 shrink-0 text-text-muted" aria-hidden />
      <div>
        <p className="font-semibold text-text-primary">No payout due: {TICKET_STATUS[ticket.status].label.toLowerCase()}</p>
        <p className="mt-0.5 text-sm text-text-secondary">{reason}</p>
      </div>
    </div>
  );
}

function Payout(): React.JSX.Element {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const { toast } = useToast();
  const [code, setCode] = useState(params.get("code") ?? "");
  const [confirming, setConfirming] = useState(false);
  const [pin, setPin] = useState("");
  const [paid, setPaid] = useState<Ticket | undefined>();
  const ticket = useTicket(code === "" ? undefined : code);
  const payout = usePayoutTicket();
  const current = paid ?? ticket.data;
  const amount = current === undefined ? 0 : (current.payout ?? current.potentialPayout);
  const refund = current?.status === "VOID";
  const pinRejected = payout.error instanceof DataSourceError && payout.error.code === "INVALID_CREDENTIALS";

  const confirm = (value: string): void => {
    if (current === undefined || value.length !== 4 || payout.isPending) return;

    payout.mutate(
      { code: current.code, pin: value },
      {
        onSuccess: (next) => {
          client.setQueryData(queryKeys.ticket(next.code), next);
          setPaid(next);
          setConfirming(false);
          toast({ tone: "success", title: `${formatMoney(next.payout ?? 0)} paid`, message: `Ticket ${next.code}` });
        },
        onError: (error) => {
          setPin("");
          /* Anything but a wrong PIN means the ticket changed under us: show its real state. */
          if (!(error instanceof DataSourceError && error.code === "INVALID_CREDENTIALS")) void ticket.refetch();
        },
      },
    );
  };

  return (
    <div className="mx-auto max-w-4xl p-4 lg:p-6">
      <PageHeader title="Payout" description="Pay a winning ticket or refund a void one. Every payout needs your PIN." />
      <TicketLookup
        key={paid?.code ?? "lookup"}
        label="Ticket ID"
        actionLabel="Find"
        initial={code}
        busy={ticket.isFetching}
        onSubmit={(next) => {
          setPaid(undefined);
          payout.reset();
          setCode(next);
          setParams({ code: next }, { replace: true });
          if (next === code) void ticket.refetch();
        }}
      />

      <div className="mt-6">
        {code === "" ? (
          <p className="rounded-md border border-dashed border-border-strong py-14 text-center text-text-muted">Enter or scan the customer's ticket to begin.</p>
        ) : ticket.isPending ? (
          <LoadingState label={`Finding ${code}`} />
        ) : ticket.isError && current === undefined ? (
          <ErrorState error={ticket.error} onRetry={() => void ticket.refetch()} />
        ) : current !== undefined ? (
          <div className="grid gap-5 md:grid-cols-[auto_minmax(0,1fr)]">
            <TicketReceipt ticket={current} />
            <div className="space-y-4">
              {paid !== undefined ? (
                <div role="status" className="rounded-md border border-success/40 bg-success-subtle p-5">
                  <p className="flex items-center gap-2 text-md font-semibold text-text-primary">
                    <BadgeCheck className="size-5 text-success" aria-hidden />
                    Payout complete
                  </p>
                  <p className="mt-2 font-display text-4xl font-bold tabular text-text-primary">{formatMoney(paid.payout ?? 0)}</p>
                  <p className="mt-1 text-sm text-text-secondary">Hand the cash to the customer and keep the ticket. The payout is in the transaction log under your name.</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      icon={<Printer className="size-4" />}
                      onClick={() => {
                        void getTicketPrinter().print({ kind: "payout-receipt" });
                      }}
                    >
                      Print receipt
                    </Button>
                    <Button
                      onClick={() => {
                        setPaid(undefined);
                        setCode("");
                        setParams({}, { replace: true });
                      }}
                    >
                      Next ticket
                    </Button>
                  </div>
                </div>
              ) : isPayable(current) ? (
                <Panel title={refund ? "Refund due" : "Winning amount"}>
                  <p className="font-display text-5xl font-bold tabular text-text-primary">{formatMoney(amount)}</p>
                  <dl className="mt-3 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-text-secondary">Result</dt>
                      <dd className="font-medium">{refund ? "Void: stake refunded" : `All ${String(current.selections.length)} selection${current.selections.length === 1 ? "" : "s"} won`}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-text-secondary">Payout status</dt>
                      <dd className="font-medium text-warning">Not paid</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-text-secondary">Customer</dt>
                      <dd className="font-medium">{current.customerName ?? "Walk-in customer"}</dd>
                    </div>
                  </dl>
                  <Button
                    size="lg"
                    full
                    className="mt-4"
                    icon={<HandCoins className="size-4" />}
                    onClick={() => {
                      payout.reset();
                      setPin("");
                      setConfirming(true);
                    }}
                  >
                    Continue to confirmation
                  </Button>
                  <p className="mt-2 text-center text-sm text-text-muted">Nothing is paid until you confirm with your PIN.</p>
                </Panel>
              ) : (
                <Blocked ticket={current} />
              )}

              {payout.isError && !pinRejected && !confirming && (
                <div role="alert" className="rounded-md border border-danger/30 bg-danger-subtle p-4 text-sm">
                  <p className="font-semibold text-danger">{presentError(payout.error).title}</p>
                  <p className="mt-0.5 text-text-primary">{payout.error instanceof Error ? payout.error.message : presentError(payout.error).message}</p>
                </div>
              )}

              <Button variant="ghost" onClick={() => void navigate(`/tickets/${current.code}`)}>
                Open full ticket
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <Modal
        open={confirming && current !== undefined}
        onClose={() => {
          if (!payout.isPending) setConfirming(false);
        }}
        title={refund ? "Confirm refund" : "Confirm payout"}
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              disabled={payout.isPending}
              onClick={() => {
                setConfirming(false);
              }}
            >
              Cancel
            </Button>
            <Button
              loading={payout.isPending}
              disabled={pin.length !== 4}
              onClick={() => {
                confirm(pin);
              }}
            >
              Pay {formatMoney(amount)}
            </Button>
          </>
        }
      >
        <p className="text-sm text-text-secondary">You are about to pay out of the shop float:</p>
        <p className="mt-1 font-display text-4xl font-bold tabular">{formatMoney(amount)}</p>
        <p className="mb-4 mt-1 font-mono text-sm text-text-muted">
          {current?.code} · {current?.customerName ?? "Walk-in customer"}
        </p>
        <CodeInput label="Enter your cashier PIN to confirm" length={4} masked autoFocus value={pin} onChange={setPin} disabled={payout.isPending} error={pinRejected ? "That PIN is not correct. Nothing was paid." : undefined} />
        {payout.isError && !pinRejected && (
          <p role="alert" className="mt-3 rounded-sm bg-danger-subtle px-3 py-2 text-sm text-danger">
            {payout.error instanceof Error ? payout.error.message : presentError(payout.error).message}
          </p>
        )}
        <p className="mt-3 text-sm text-text-muted">This cannot be reversed from the terminal.</p>
      </Modal>
    </div>
  );
}

export function PayoutPage(): React.JSX.Element {
  return (
    <Guard permission="tickets:payout">
      <Payout />
    </Guard>
  );
}
