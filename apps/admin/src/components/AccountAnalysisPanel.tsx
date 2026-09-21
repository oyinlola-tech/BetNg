import type { AccountAnalysis } from "@betng/contracts";
import { formatMoney } from "@betng/ui-core";
import { DataSourceError } from "@betng/ui-core";
import { EmptyState, ErrorState, SkeletonRows } from "@betng/ui-web";
import { formatCount } from "../lib/format";
import { DetailItem, SignedMoney, Unavailable } from "./Bits";

const SUBJECT: Readonly<Record<AccountAnalysis["subjectKind"], string>> = { CUSTOMER: "customer", SHOP: "shop", CASHIER: "cashier" };

/** The platform's view over the global bets for one customer, shop or cashier. */
export function AccountAnalysisPanel({ query }: { readonly query: { readonly data: AccountAnalysis | undefined; readonly error: unknown; readonly refetch: () => unknown } }): React.JSX.Element {
  const a = query.data;

  if (a === undefined) {
    if (query.error instanceof DataSourceError && query.error.code === "NOT_FOUND") return <EmptyState compact title="No analysis for this subject" description="The platform has no bets recorded against it." />;

    return query.error !== null && query.error !== undefined ? <ErrorState error={query.error} compact onRetry={() => void query.refetch()} /> : <SkeletonRows rows={4} />;
  }

  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
      <DetailItem label="Bets">{formatCount(a.bets)}</DetailItem>
      <DetailItem label="Pending">{formatCount(a.pendingBets)}</DetailItem>
      <DetailItem label="Won / lost / void">
        <span className="tabular">
          {formatCount(a.wins)} / {formatCount(a.losses)} / {formatCount(a.voids)}
        </span>
      </DetailItem>
      <DetailItem label="Wallet transactions">{a.transactions === undefined ? <Unavailable what="The transaction count" /> : formatCount(a.transactions)}</DetailItem>
      <DetailItem label="Stake">
        <span className="type-financial">{formatMoney(a.stake)}</span>
      </DetailItem>
      <DetailItem label={a.subjectKind === "CASHIER" ? "Payout processed" : "Payout"}>
        <span className="type-financial">{formatMoney(a.payout)}</span>
      </DetailItem>
      <DetailItem label={`Net result for the ${SUBJECT[a.subjectKind]}`}>
        <SignedMoney value={a.netResult} className="type-financial" />
      </DetailItem>
      <DetailItem label="Operator contribution">
        <SignedMoney value={a.operatorContribution} className="type-financial" />
      </DetailItem>
      {a.subjectKind === "SHOP" && <DetailItem label="Commission">{a.commission === undefined ? <Unavailable what="Commission" /> : <span className="type-financial">{formatMoney(a.commission)}</span>}</DetailItem>}
    </dl>
  );
}
