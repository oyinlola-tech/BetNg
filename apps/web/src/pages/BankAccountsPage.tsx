import { useState } from "react";
import { Plus } from "lucide-react";
import { Button, Card, SectionHeader, SectionHeading, SkeletonRows } from "@betng/ui-web";
import { AddBankAccountForm } from "../features/payments/AddBankAccountForm";
import { BankAccountList } from "../features/payments/BankAccountList";
import { useBankAccounts } from "../features/payments/paymentQueries";
import { FlagGuard, ServiceError } from "../features/wallet/ServiceStates";
import { usePageMeta } from "../features/seo";

function BankAccounts(): React.JSX.Element {
  const accounts = useBankAccounts();
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-5">
      {adding && (
        <Card>
          <SectionHeading as="h2">Add a bank account</SectionHeading>
          <p className="type-small mt-1 mb-4 text-text-muted">Withdrawals can only be paid to an account in your own name.</p>
          <AddBankAccountForm
            onDone={() => {
              setAdding(false);
            }}
          />
        </Card>
      )}
      <Card padding="none">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <SectionHeading as="h2">Saved accounts</SectionHeading>
          {!adding && accounts.data !== undefined && accounts.data.length > 0 && (
            <Button
              size="sm"
              variant="secondary"
              leadingIcon={<Plus className="size-3.5" aria-hidden />}
              onClick={() => {
                setAdding(true);
              }}
            >
              Add bank account
            </Button>
          )}
        </div>
        {accounts.data !== undefined ? (
          <BankAccountList
            accounts={accounts.data}
            onAdd={() => {
              setAdding(true);
            }}
          />
        ) : accounts.isError ? (
          <ServiceError error={accounts.error} onRetry={() => void accounts.refetch()} />
        ) : (
          <SkeletonRows rows={3} className="p-4" />
        )}
      </Card>
    </div>
  );
}

export function BankAccountsPage(): React.JSX.Element {
  usePageMeta({ title: "Bank accounts", noindex: true });

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <SectionHeader as="h1" eyebrow="Wallet" title="Bank accounts" to="/wallet" linkLabel="Wallet" />
      <FlagGuard flag="paymentsEnabled" title="Bank accounts are not available yet" description="Saving bank accounts for withdrawals is not switched on for BETNG yet.">
        <BankAccounts />
      </FlagGuard>
    </div>
  );
}
