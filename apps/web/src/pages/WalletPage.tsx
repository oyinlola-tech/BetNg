import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import {
  formatDateTime,
  formatMoney,
  formatSignedMoney,
  parseStakeInput,
} from "@betng/ui-core";
import {
  Button,
  cn,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  presentError,
  SectionHeader,
  SkeletonRows,
  useToast,
} from "@betng/ui-web";
import {
  useDeposit,
  useTransactions,
  useWallet,
  useWithdraw,
} from "../hooks/queries";

type Action = "DEPOSIT" | "WITHDRAW" | undefined;

export function WalletPage(): React.JSX.Element {
  const wallet = useWallet();
  const transactions = useTransactions();
  const deposit = useDeposit();
  const withdraw = useWithdraw();
  const { toast } = useToast();
  const [action, setAction] = useState<Action>(undefined);
  const [amountText, setAmountText] = useState("5000");
  const amount = parseStakeInput(amountText);
  const busy = deposit.isPending || withdraw.isPending;

  const submit = async (): Promise<void> => {
    try {
      if (action === "DEPOSIT") await deposit.mutateAsync(amount);
      else await withdraw.mutateAsync(amount);

      toast({
        tone: "success",
        title:
          action === "DEPOSIT"
            ? "Simulated deposit added"
            : "Simulated withdrawal made",
        message: formatMoney(amount),
      });
      setAction(undefined);
    } catch (error) {
      const p = presentError(error);

      toast({ tone: "danger", title: p.title, message: p.message });
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader as="h1" eyebrow="Simulated balance" title="Wallet" />
      {wallet.isError ? (
        <ErrorState
          error={wallet.error}
          onRetry={() => void wallet.refetch()}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-md border border-border bg-surface p-5 md:col-span-2">
            <p className="caps-label">Available</p>
            <p className="mt-1 font-display text-4xl font-bold tabular tracking-tight">
              {wallet.data === undefined
                ? "…"
                : formatMoney(wallet.data.available)}
            </p>
            <div className="mt-4 flex flex-wrap gap-6 text-sm">
              <span className="text-text-secondary">
                Balance{" "}
                <span className="font-semibold tabular text-text-primary">
                  {wallet.data === undefined
                    ? "…"
                    : formatMoney(wallet.data.balance)}
                </span>
              </span>
              <span className="text-text-secondary">
                Reserved in open bets{" "}
                <span className="font-semibold tabular text-text-primary">
                  {wallet.data === undefined
                    ? "…"
                    : formatMoney(wallet.data.reserved)}
                </span>
              </span>
            </div>
            <div className="mt-5 flex gap-2">
              <Button
                icon={<ArrowDownToLine className="size-4" />}
                onClick={() => {
                  setAction("DEPOSIT");
                }}
              >
                Deposit
              </Button>
              <Button
                variant="secondary"
                icon={<ArrowUpFromLine className="size-4" />}
                onClick={() => {
                  setAction("WITHDRAW");
                }}
              >
                Withdraw
              </Button>
            </div>
          </div>
          <div className="rounded-md border border-warning/40 bg-warning-subtle p-5 text-sm text-text-secondary">
            <p className="font-semibold text-warning">Play-money only</p>
            <p className="mt-1">
              This wallet is a simulation for a portfolio project. Deposits and
              withdrawals move a number in a database; no payment provider is
              connected and nothing here has real-world value.
            </p>
          </div>
        </div>
      )}

      <section>
        <SectionHeader title="Transactions" className="mb-2" />
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
                  <span className="hidden w-24 text-right tabular text-text-muted sm:inline">
                    {formatMoney(t.balanceAfter)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <Modal
        open={action !== undefined}
        onClose={() => {
          setAction(undefined);
        }}
        title={
          action === "DEPOSIT" ? "Simulated deposit" : "Simulated withdrawal"
        }
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setAction(undefined);
              }}
            >
              Cancel
            </Button>
            <Button
              loading={busy}
              disabled={amount <= 0}
              onClick={() => void submit()}
            >
              {action === "DEPOSIT" ? "Add funds" : "Withdraw"}
            </Button>
          </>
        }
      >
        <Input
          label="Amount"
          prefix="₦"
          inputMode="decimal"
          value={amountText}
          onChange={(e) => {
            setAmountText(e.target.value);
          }}
          hint="Play-money. No real payment takes place."
          error={amount <= 0 ? "Enter an amount." : undefined}
        />
      </Modal>
    </div>
  );
}
