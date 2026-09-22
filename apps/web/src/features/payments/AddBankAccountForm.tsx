import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { BadgeCheck } from "lucide-react";
import type { BankAccountVerification } from "@betng/contracts";
import { DataSourceError } from "@betng/ui-core";
import { Button, Checkbox, Field, FormError, Input, applyFieldErrors, useToast } from "@betng/ui-web";
import { keys } from "../../lib/queryKeys";
import { accountServices, logger } from "../../services/runtime";
import { maskedAccount } from "./paymentMeta";
import { useBanks } from "./paymentQueries";

const schema = z.object({
  bankCode: z.string().min(1, "Choose your bank."),
  accountNumber: z
    .string()
    .trim()
    .regex(/^\d{10}$/, "Enter the 10-digit account number (NUBAN)."),
});

type Values = z.infer<typeof schema>;

export interface AddBankAccountFormProps {
  readonly onDone: () => void;
}

/**
 * Name enquiry first: the platform returns the account holder's name, and the
 * account is saved from that verification. The browser never supplies a name.
 */
export function AddBankAccountForm({ onDone }: AddBankAccountFormProps): React.JSX.Element {
  const client = useQueryClient();
  const { toast } = useToast();
  const banks = useBanks(true);
  const [verification, setVerification] = useState<BankAccountVerification>();
  const [bankName, setBankName] = useState<string>();
  const [makeDefault, setMakeDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<unknown>();

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { bankCode: "", accountNumber: "" }, mode: "onSubmit" });

  const verify = form.handleSubmit(async (values) => {
    setFailure(undefined);

    try {
      const result = await accountServices.payments.verifyBankAccount({ bankCode: values.bankCode, accountNumber: values.accountNumber });

      setVerification(result);
      setBankName(banks.data?.find((bank) => bank.code === values.bankCode)?.name);
      form.reset({ bankCode: values.bankCode, accountNumber: "" });
    } catch (cause) {
      logger.warn("flow", "Bank account verification failed", { code: cause instanceof DataSourceError ? cause.code : "UNKNOWN" });

      const { applied, unmatched } = applyFieldErrors(cause, form.setError, ["bankCode", "accountNumber"]);

      if (applied.length === 0 || Object.keys(unmatched).length > 0) setFailure(cause);
    }
  });

  const save = async (): Promise<void> => {
    if (verification === undefined) return;

    setSaving(true);
    setFailure(undefined);

    try {
      await accountServices.payments.saveBankAccount(verification.verificationId, makeDefault);
      await client.invalidateQueries({ queryKey: keys.bankAccounts });
      toast({ kind: "wallet", tone: "success", title: "Bank account saved", message: `${verification.accountName} is ready for withdrawals.` });
      onDone();
    } catch (cause) {
      logger.warn("flow", "Saving a bank account failed", { code: cause instanceof DataSourceError ? cause.code : "UNKNOWN" });
      setFailure(cause);
      if (cause instanceof DataSourceError && cause.code === "CONFLICT") setVerification(undefined);
    } finally {
      setSaving(false);
    }
  };

  if (verification !== undefined) {
    return (
      <div className="space-y-4">
        <FormError error={failure} />
        <div className="rounded-md border border-border bg-surface-sunken p-4">
          <p className="type-caption">Account holder</p>
          <p className="type-h3 mt-1 flex items-center gap-2 text-text-primary" data-testid="verified-account-name">
            <BadgeCheck className="size-4 text-success" aria-hidden />
            {verification.accountName}
          </p>
          <p className="type-small mt-1 text-text-secondary">
            {bankName ?? "Your bank"} · {maskedAccount(verification.accountNumberMasked)}
          </p>
          <p className="type-small mt-2 text-text-muted">The name comes from your bank. Withdrawals can only go to an account in your own name.</p>
        </div>
        <Checkbox
          label="Use this as my default account"
          checked={makeDefault}
          onChange={(event) => {
            setMakeDefault(event.target.checked);
          }}
        />
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="ghost"
            disabled={saving}
            onClick={() => {
              setVerification(undefined);
              setFailure(undefined);
            }}
          >
            Not my account
          </Button>
          <Button loading={saving} onClick={() => void save()}>
            Save account
          </Button>
        </div>
      </div>
    );
  }

  const busy = form.formState.isSubmitting;

  return (
    <form onSubmit={(event) => void verify(event)} noValidate className="space-y-4">
      <FormError error={failure} />
      {banks.isError && <FormError error={banks.error} onRetry={() => void banks.refetch()} />}
      <Field label="Bank" error={form.formState.errors.bankCode?.message} required>
        {(control) => (
          <select
            {...control}
            {...form.register("bankCode")}
            disabled={busy || banks.data === undefined}
            className="h-10 w-full rounded-sm border border-border bg-surface-sunken px-3 text-base text-text-primary focus-ring"
          >
            <option value="">{banks.data === undefined ? "Loading banks…" : "Choose your bank"}</option>
            {banks.data?.map((bank) => (
              <option key={bank.code} value={bank.code}>
                {bank.name}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Input
        label="Account number"
        inputMode="numeric"
        autoComplete="off"
        maxLength={10}
        disabled={busy}
        hint="10 digits. We check it with your bank before saving."
        error={form.formState.errors.accountNumber?.message}
        {...form.register("accountNumber")}
      />
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" disabled={busy} onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          Verify account
        </Button>
      </div>
    </form>
  );
}
