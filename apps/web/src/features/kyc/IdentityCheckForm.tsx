import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import type { IdentityCheckResult } from "@betng/contracts";
import { DataSourceError } from "@betng/ui-core";
import { Button, FormError, Input, applyFieldErrors, useToast } from "@betng/ui-web";
import { keys } from "../../lib/queryKeys";
import { accountServices, logger } from "../../services/runtime";
import { KycStatusBadge } from "./KycStatusBadge";

export type IdentityCheck = "BVN" | "NIN";

const COPY: Readonly<Record<IdentityCheck, { readonly label: string; readonly hint: string }>> = {
  BVN: { label: "BVN", hint: "Dial *565*0# on the phone number linked to your bank to see it." },
  NIN: { label: "NIN", hint: "The 11-digit number on your NIN slip or NIMC app." },
};

function maxBirthDate(): string {
  const date = new Date();

  date.setFullYear(date.getFullYear() - 18);

  return date.toISOString().slice(0, 10);
}

const schema = z.object({
  number: z.string().trim().regex(/^\d{11}$/, "Enter the 11 digits."),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter your date of birth."),
});

type Values = z.infer<typeof schema>;

/** The number goes to the platform once and is cleared from the form; it is never stored or logged in the browser. */
export function IdentityCheckForm({ check }: { readonly check: IdentityCheck }): React.JSX.Element {
  const client = useQueryClient();
  const { toast } = useToast();
  const [result, setResult] = useState<IdentityCheckResult>();
  const [failure, setFailure] = useState<unknown>();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { number: "", dateOfBirth: "" }, mode: "onSubmit" });
  const copy = COPY[check];

  const submit = form.handleSubmit(async (values) => {
    setFailure(undefined);
    setResult(undefined);

    try {
      const outcome =
        check === "BVN"
          ? await accountServices.kyc.verifyBvn({ bvn: values.number, dateOfBirth: values.dateOfBirth })
          : await accountServices.kyc.verifyNin({ nin: values.number, dateOfBirth: values.dateOfBirth });

      setResult(outcome);
      toast({ kind: "wallet", tone: "info", title: "KYC submitted", message: `Your ${check} was sent for checking.` });
    } catch (cause) {
      logger.warn("flow", "Identity check failed", { check, code: cause instanceof DataSourceError ? cause.code : "UNKNOWN" });
      applyFieldErrors(cause, form.setError, []);
      setFailure(cause);
    } finally {
      form.reset({ number: "", dateOfBirth: "" }, { keepErrors: true });
      void client.invalidateQueries({ queryKey: keys.kycRoot });
    }
  });

  const busy = form.formState.isSubmitting;

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="space-y-3" aria-label={`Verify ${check}`}>
      <FormError error={failure} />
      {result !== undefined && (
        <div role="status" className="flex flex-wrap items-center gap-2 rounded-sm border border-border bg-surface-sunken px-3 py-2">
          <KycStatusBadge status={result.status} />
          {result.message !== undefined && <span className="type-small text-text-secondary">{result.message}</span>}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label={copy.label}
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          maxLength={11}
          disabled={busy}
          hint={copy.hint}
          error={form.formState.errors.number?.message}
          {...form.register("number")}
        />
        <Input type="date" label="Date of birth" autoComplete="bday" max={maxBirthDate()} disabled={busy} error={form.formState.errors.dateOfBirth?.message} {...form.register("dateOfBirth")} />
      </div>
      <div className="flex justify-end">
        <Button type="submit" loading={busy}>
          Verify {check}
        </Button>
      </div>
    </form>
  );
}
