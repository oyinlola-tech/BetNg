import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Ban, CheckCircle2, Copy, FilePlus2, HandCoins, Printer, ScanLine } from "lucide-react";
import { Button, ConfirmDialog, ErrorState, LoadingState, presentError, useToast } from "@betng/ui-web";
import { Guard } from "../components/Guard";
import { TicketReceipt } from "../components/TicketReceipt";
import { useCancelTicket, useTicket } from "../hooks/queries";
import { useShopSession } from "../hooks/useShopSession";
import { queryKeys } from "../lib/queryKeys";
import { isPayable } from "../lib/ticket";

function TicketView(): React.JSX.Element {
  const { code } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const { toast } = useToast();
  const { can } = useShopSession();
  const ticket = useTicket(code);
  const cancel = useCancelTicket();
  const [cancelling, setCancelling] = useState(false);

  if (ticket.isPending) return <LoadingState label="Fetching ticket" />;
  if (ticket.isError) return <ErrorState error={ticket.error} onRetry={() => void ticket.refetch()} />;

  const t = ticket.data;

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(t.code);
      toast({ tone: "success", title: "Ticket ID copied", message: t.code });
    } catch {
      toast({ tone: "danger", title: "Could not copy", message: "Select the ticket ID and copy it manually." });
    }
  };

  return (
    <div className="mx-auto grid max-w-4xl gap-6 p-4 lg:grid-cols-[auto_minmax(0,1fr)] lg:p-6">
      <TicketReceipt ticket={t} className="mx-auto" />

      <div className="space-y-4 print:hidden">
        {params.get("sold") === "1" && (
          <div role="status" className="flex items-start gap-2.5 rounded-md border border-success/30 bg-success-subtle px-4 py-3">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
            <div>
              <p className="font-semibold text-text-primary">Ticket issued</p>
              <p className="text-sm text-text-secondary">Print it and hand it to the customer. The ticket ID is the only proof of the bet.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Button
            size="lg"
            autoFocus
            icon={<Printer className="size-4" />}
            onClick={() => {
              window.print();
            }}
          >
            Print
          </Button>
          <Button size="lg" variant="secondary" icon={<Copy className="size-4" />} onClick={() => void copy()}>
            Copy ID
          </Button>
          <Button size="lg" variant="secondary" icon={<ScanLine className="size-4" />} onClick={() => void navigate(`/tickets/check?code=${t.code}`)}>
            Check
          </Button>
          <Button size="lg" variant="secondary" icon={<FilePlus2 className="size-4" />} onClick={() => void navigate("/tickets/new")}>
            New Ticket
          </Button>
        </div>

        {isPayable(t) && can("tickets:payout") && (
          <Button size="lg" full icon={<HandCoins className="size-4" />} onClick={() => void navigate(`/cashier/payout?code=${t.code}`)}>
            {t.status === "VOID" ? "Refund stake" : "Go to payout"}
          </Button>
        )}

        {t.status === "OPEN" && can("tickets:cancel") && (
          <div className="rounded-md border border-border p-4">
            <p className="font-semibold">Cancel this ticket</p>
            <p className="mt-0.5 text-sm text-text-muted">Possible only while betting is still open on every selection. The stake goes back to the customer and the cancellation is logged.</p>
            <Button
              variant="secondary"
              className="mt-3"
              icon={<Ban className="size-4" />}
              onClick={() => {
                cancel.reset();
                setCancelling(true);
              }}
            >
              Cancel ticket
            </Button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={cancelling}
        onClose={() => {
          setCancelling(false);
        }}
        title={`Cancel ${t.code}?`}
        description="The customer gets the full stake back. This cannot be undone."
        confirmLabel="Cancel ticket and refund"
        tone="danger"
        requireReason
        loading={cancel.isPending}
        onConfirm={(reason) => {
          cancel.mutate(
            { code: t.code, reason },
            {
              onSuccess: (next) => {
                client.setQueryData(queryKeys.ticket(next.code), next);
                setCancelling(false);
                toast({ tone: "success", title: "Ticket cancelled", message: "Return the stake to the customer." });
              },
            },
          );
        }}
      >
        {cancel.isError && (
          <p role="alert" className="rounded-sm bg-danger-subtle px-3 py-2 text-sm text-danger">
            {cancel.error instanceof Error ? cancel.error.message : presentError(cancel.error).message}
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}

export function TicketPage(): React.JSX.Element {
  return (
    <Guard permission="tickets:check">
      <TicketView />
    </Guard>
  );
}
