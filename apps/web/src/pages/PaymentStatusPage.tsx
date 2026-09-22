import { useMemo } from "react";
import { Navigate, useParams, useSearchParams } from "react-router";
import { Card, NotFoundState, SectionHeader } from "@betng/ui-web";
import { paymentPath, readDirection, readInFlight, validReference } from "../features/payments/paymentMeta";
import { PaymentStatusView } from "../features/payments/PaymentStatusView";
import { LinkButton } from "../features/wallet/LinkButton";
import { FlagGuard } from "../features/wallet/ServiceStates";
import { usePageMeta } from "../features/seo";

const UNAVAILABLE = { title: "Payments are not available yet", description: "Payment tracking is not switched on for BETNG yet." };

export function PaymentStatusPage(): React.JSX.Element {
  usePageMeta({ title: "Payment status", noindex: true });

  const params = useParams();
  const [search] = useSearchParams();
  const reference = validReference(params.reference);
  const direction = readDirection(search.get("direction"));

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <SectionHeader as="h1" eyebrow="Payments" title="Payment status" to="/payments" linkLabel="Payment history" />
      <FlagGuard flag="paymentsEnabled" {...UNAVAILABLE}>
        {reference === undefined ? (
          <Card padding="none">
            <NotFoundState title="Payment not found" description="That payment reference is not valid. Check the link or open your payment history." action={<LinkButton to="/payments" size="sm">Payment history</LinkButton>} />
          </Card>
        ) : (
          <PaymentStatusView key={`${direction}:${reference}`} reference={reference} direction={direction} />
        )}
      </FlagGuard>
    </div>
  );
}

/** Where the provider sends the customer back. The reference in the URL (or the one kept for this tab) decides where to look; the status comes from the platform. */
export function PaymentReturnPage(): React.JSX.Element {
  usePageMeta({ title: "Payment status", noindex: true });

  const [search] = useSearchParams();
  const target = useMemo(() => {
    const fromUrl = validReference(search.get("reference") ?? search.get("trxref") ?? search.get("tx_ref"));
    const kept = readInFlight();

    if (fromUrl !== undefined) return paymentPath(fromUrl, kept?.reference === fromUrl ? kept.direction : "DEPOSIT");

    return kept === undefined ? undefined : paymentPath(kept.reference, kept.direction);
  }, [search]);

  if (target !== undefined) return <Navigate to={target} replace />;

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <SectionHeader as="h1" eyebrow="Payments" title="Payment status" />
      <Card padding="none">
        <NotFoundState
          title="We could not tell which payment this was"
          description="Your payment history shows every payment and its status as the platform reports it."
          action={<LinkButton to="/payments" size="sm">Payment history</LinkButton>}
        />
      </Card>
    </div>
  );
}
