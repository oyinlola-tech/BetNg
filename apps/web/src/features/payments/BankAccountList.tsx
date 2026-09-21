import { useState } from "react";
import { BadgeCheck, Landmark, Star, Trash2 } from "lucide-react";
import type { BankAccount } from "@betng/contracts";
import { formatShortDate } from "@betng/ui-core";
import { Badge, Button, ConfirmDialog, EmptyState, FormError, useToast } from "@betng/ui-web";
import { maskedAccount } from "./paymentMeta";
import { useDeleteBankAccount, useSetDefaultBankAccount } from "./paymentQueries";

export interface BankAccountListProps {
  readonly accounts: readonly BankAccount[];
  readonly onAdd: () => void;
}

export function BankAccountList({ accounts, onAdd }: BankAccountListProps): React.JSX.Element {
  const setDefault = useSetDefaultBankAccount();
  const remove = useDeleteBankAccount();
  const { toast } = useToast();
  const [deleting, setDeleting] = useState<BankAccount>();

  if (accounts.length === 0) {
    return (
      <EmptyState
        icon={<Landmark className="size-5" />}
        title="No saved bank accounts"
        description="Add an account in your name to withdraw to it."
        action={
          <Button size="sm" onClick={onAdd}>
            Add bank account
          </Button>
        }
      />
    );
  }

  return (
    <>
      {(setDefault.error !== null || remove.error !== null) && (
        <FormError className="m-4" error={setDefault.error ?? remove.error} />
      )}
      <ul className="divide-y divide-border" aria-label="Saved bank accounts">
        {accounts.map((account) => (
          <li key={account.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-surface-sunken text-text-muted">
              <Landmark className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="type-body flex flex-wrap items-center gap-2 font-semibold text-text-primary">
                {account.bankName}
                <span className="font-mono text-sm font-normal text-text-secondary">{maskedAccount(account.accountNumberMasked)}</span>
                {account.isDefault && (
                  <Badge tone="brand" icon={<Star className="size-3" aria-hidden />}>
                    Default
                  </Badge>
                )}
              </span>
              <span className="type-small mt-0.5 flex flex-wrap items-center gap-x-2 text-text-muted">
                <span className="truncate">{account.accountName}</span>
                {account.verified && (
                  <span className="inline-flex items-center gap-1 text-text-secondary">
                    <BadgeCheck className="size-3.5 text-success" aria-hidden />
                    Verified
                  </span>
                )}
                <span>Added {formatShortDate(account.createdAt)}</span>
              </span>
            </span>
            <span className="flex gap-1.5">
              {!account.isDefault && (
                <Button
                  variant="secondary"
                  size="sm"
                  loading={setDefault.isPending && setDefault.variables === account.id}
                  onClick={() => {
                    remove.reset();
                    setDefault.mutate(account.id);
                  }}
                >
                  Make default
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Remove ${account.bankName} ${maskedAccount(account.accountNumberMasked)}`}
                leadingIcon={<Trash2 className="size-3.5" aria-hidden />}
                onClick={() => {
                  setDefault.reset();
                  setDeleting(account);
                }}
              >
                Remove
              </Button>
            </span>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={deleting !== undefined}
        tone="danger"
        title="Remove bank account"
        confirmLabel="Remove account"
        loading={remove.isPending}
        description={deleting === undefined ? "" : `Remove ${deleting.bankName} ${maskedAccount(deleting.accountNumberMasked)}? You can add it again later.`}
        onClose={() => {
          setDeleting(undefined);
        }}
        onConfirm={async () => {
          if (deleting === undefined) return;

          try {
            await remove.mutateAsync(deleting.id);
            toast({ kind: "wallet", tone: "success", title: "Bank account removed" });
          } catch {
            /* the error is shown above the list */
          } finally {
            setDeleting(undefined);
          }
        }}
      />
    </>
  );
}
