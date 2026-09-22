import { SectionHeader } from "@betng/ui-web";
import { ResponsibleGamingBanner } from "../features/limits";
import { DepositFlow } from "../features/payments/DepositFlow";
import { FlagGuard } from "../features/wallet/ServiceStates";
import { usePageMeta } from "../features/seo";

export function DepositPage(): React.JSX.Element {
  usePageMeta({ title: "Deposit", noindex: true });

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <SectionHeader as="h1" eyebrow="Wallet" title="Deposit" to="/wallet" linkLabel="Wallet" />
      <FlagGuard flag="paymentsEnabled" title="Deposits are not available yet" description="Paying in through a payment provider is not switched on for BETNG yet. Nothing has been charged.">
        <ResponsibleGamingBanner />
        <DepositFlow />
      </FlagGuard>
    </div>
  );
}
