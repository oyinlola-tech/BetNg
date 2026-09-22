import { SectionHeader } from "@betng/ui-web";
import { WithdrawFlow } from "../features/payments/WithdrawFlow";
import { FlagGuard } from "../features/wallet/ServiceStates";
import { usePageMeta } from "../features/seo";

export function WithdrawPage(): React.JSX.Element {
  usePageMeta({ title: "Withdraw", noindex: true });

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <SectionHeader as="h1" eyebrow="Wallet" title="Withdraw" to="/wallet" linkLabel="Wallet" />
      <FlagGuard flag="paymentsEnabled" title="Withdrawals are not available yet" description="Paying out to a bank account is not switched on for BETNG yet. Your balance is unchanged.">
        <WithdrawFlow />
      </FlagGuard>
    </div>
  );
}
