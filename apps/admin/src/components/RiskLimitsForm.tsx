import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { RiskLimits } from "@betng/contracts";
import { formatDateTime } from "@betng/ui-core";
import { ConfirmationDialog, FormActions, FormError, applyFieldErrors } from "@betng/ui-web";
import { useAdminAction } from "../hooks/queries";
import { useAdmin } from "../hooks/useAdmin";
import { keys } from "../lib/queryKeys";
import { RISK_LIMIT_FIELDS, riskLimitsSchema, toMinor, toMoneyText, type RiskLimitField, type RiskLimitsValues } from "../lib/schemas";
import { adminSource } from "../services/runtime";
import { MoneyField } from "./form/TextField";
import { GuardedButton } from "./Guard";
import { UnsavedChangesDialog } from "./UnsavedChangesDialog";

const LABELS: Readonly<Record<RiskLimitField, { readonly label: string; readonly hint: string }>> = {
  minStake: { label: "Minimum stake", hint: "Below this the risk service refuses the bet." },
  maxStakePerBet: { label: "Maximum stake per bet", hint: "Above this the stake is limited." },
  maxPayoutPerBet: { label: "Maximum payout per bet", hint: "Caps what a single bet can return." },
  maxLiabilityPerSelection: { label: "Liability limit per selection", hint: "Net exposure allowed on one selection." },
  maxLiabilityPerMarket: { label: "Liability limit per market", hint: "Worst-case exposure allowed on one market." },
  maxLiabilityPerMatch: { label: "Liability limit per match", hint: "Worst-case exposure allowed on one match." },
};

function toValues(limits: RiskLimits): RiskLimitsValues {
  return Object.fromEntries(RISK_LIMIT_FIELDS.map((field) => [field, toMoneyText(limits[field])])) as RiskLimitsValues;
}

/** The limits the risk service applies. This form edits them; the service alone decides each bet. */
export function RiskLimitsForm({ limits }: { readonly limits: RiskLimits }): React.JSX.Element {
  const { can } = useAdmin();
  const editable = can("risk:write");
  const form = useForm<RiskLimitsValues>({ resolver: zodResolver(riskLimitsSchema), defaultValues: toValues(limits), mode: "onTouched" });
  const { errors, isDirty, dirtyFields } = form.formState;
  const [pending, setPending] = useState<RiskLimitsValues | undefined>();
  const [failure, setFailure] = useState<unknown>();

  const save = useAdminAction({
    run: (input: { readonly values: RiskLimitsValues; readonly reason: string }) => {
      const changed = Object.fromEntries(RISK_LIMIT_FIELDS.filter((field) => dirtyFields[field] === true).map((field) => [field, toMinor(input.values[field])]));

      return adminSource.updateRiskLimits({ ...changed, reason: input.reason });
    },
    success: (saved) => `Risk limits updated to version ${String(saved.version)}`,
    invalidate: [keys.riskLimits, keys.exposure, keys.risk],
    silentError: true,
    onDone: (saved) => {
      setPending(undefined);
      form.reset(toValues(saved));
    },
  });

  useEffect(() => {
    if (!isDirty) form.reset(toValues(limits));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limits.version]);

  return (
    <>
      <form
        noValidate
        aria-label="Risk limits"
        onSubmit={(event) => {
          void form.handleSubmit((values) => {
            setFailure(undefined);
            setPending(values);
          })(event);
        }}
        onReset={(event) => {
          event.preventDefault();
        }}
      >
        <p className="mb-4 text-sm text-text-muted">
          Version {limits.version}, updated {formatDateTime(limits.updatedAt)}
          {limits.updatedBy === undefined ? "" : ` by ${limits.updatedBy}`}.
        </p>
        <FormError error={failure} className="mb-4" />
        <fieldset disabled={!editable} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {RISK_LIMIT_FIELDS.map((field) => (
            <MoneyField key={field} label={LABELS[field].label} hint={LABELS[field].hint} required error={errors[field]?.message} {...form.register(field)} />
          ))}
        </fieldset>
        <div className="mt-5 border-t border-border pt-4">
          {editable ? (
            <FormActions submitLabel="Review changes" dirty={isDirty} loading={save.isPending} onReset={() => form.reset(toValues(limits))} />
          ) : (
            <div className="flex justify-end">
              <GuardedButton permission="risk:write">Review changes</GuardedButton>
            </div>
          )}
        </div>
      </form>
      <ConfirmationDialog
        open={pending !== undefined}
        onClose={() => {
          if (!save.isPending) setPending(undefined);
        }}
        title="Apply new risk limits?"
        description="The risk service uses these limits for every bet assessed from now on. Bets already accepted are not affected."
        confirmLabel="Apply limits"
        tone="danger"
        requireReason
        loading={save.isPending}
        onConfirm={async (reason) => {
          if (pending === undefined) return;

          try {
            await save.mutateAsync({ values: pending, reason });
          } catch (error) {
            applyFieldErrors(error, form.setError, RISK_LIMIT_FIELDS);
            setFailure(error);
            setPending(undefined);
          }
        }}
      />
      <UnsavedChangesDialog dirty={isDirty} />
    </>
  );
}
