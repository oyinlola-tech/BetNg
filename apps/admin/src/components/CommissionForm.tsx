import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { AdminShopSummary } from "@betng/contracts";
import { ConfirmationDialog, FormActions, FormError, Select, applyFieldErrors } from "@betng/ui-web";
import { useAdminAction } from "../hooks/queries";
import { keys } from "../lib/queryKeys";
import { commissionSchema, type CommissionValues } from "../lib/schemas";
import { adminSource } from "../services/runtime";
import { TextField } from "./form/TextField";

const DEFAULT = "default";

export function CommissionForm({ shops }: { readonly shops: readonly AdminShopSummary[] }): React.JSX.Element {
  const form = useForm<CommissionValues>({ resolver: zodResolver(commissionSchema), defaultValues: { shopId: DEFAULT, shopSharePercent: Number.NaN }, mode: "onTouched" });
  const [pending, setPending] = useState<CommissionValues | undefined>();
  const [failure, setFailure] = useState<unknown>();
  const save = useAdminAction({
    run: (input: { readonly values: CommissionValues; readonly reason: string }) => adminSource.updateCommissionConfig({ ...(input.values.shopId === DEFAULT ? {} : { shopId: input.values.shopId }), shopSharePercent: input.values.shopSharePercent, reason: input.reason }),
    success: () => "Commission share updated",
    invalidate: [keys.commissionConfig, ["admin", "commission"]],
    silentError: true,
    onDone: () => {
      setPending(undefined);
      form.reset();
    },
  });
  const target = pending === undefined || pending.shopId === DEFAULT ? "every shop without its own share" : (shops.find((s) => s.id === pending.shopId)?.code ?? "this shop");

  return (
    <>
      <form
        noValidate
        aria-label="Change commission share"
        className="space-y-4"
        onSubmit={(event) => {
          void form.handleSubmit((values) => {
            setFailure(undefined);
            setPending(values);
          })(event);
        }}
      >
        <FormError error={failure} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <span aria-hidden className="mb-1.5 block text-sm font-medium text-text-secondary">
              Applies to
            </span>
            <Controller
              control={form.control}
              name="shopId"
              render={({ field }) => <Select label="Applies to" className="w-full [&>select]:w-full" value={field.value} onChange={field.onChange} options={[{ value: DEFAULT, label: "Platform default" }, ...shops.map((s) => ({ value: s.id, label: `${s.code} · ${s.name}` }))]} />}
            />
          </div>
          <TextField label="Shop share" type="number" inputMode="decimal" min={0} max={100} step={0.5} required hint="Percent of the gross operator result" error={form.formState.errors.shopSharePercent?.message} {...form.register("shopSharePercent", { valueAsNumber: true })} />
        </div>
        <FormActions submitLabel="Review change" dirty={form.formState.isDirty} loading={save.isPending} onReset={() => form.reset()} />
      </form>
      <ConfirmationDialog
        open={pending !== undefined}
        onClose={() => {
          if (!save.isPending) setPending(undefined);
        }}
        title="Change the commission share?"
        description={`The shop share becomes ${String(pending?.shopSharePercent ?? "")}% for ${target}. It applies to commission calculated from now on.`}
        confirmLabel="Change share"
        tone="danger"
        requireReason
        loading={save.isPending}
        onConfirm={async (reason) => {
          if (pending === undefined) return;

          try {
            await save.mutateAsync({ values: pending, reason });
          } catch (error) {
            applyFieldErrors(error, form.setError, ["shopId", "shopSharePercent"]);
            setFailure(error);
            setPending(undefined);
          }
        }}
      />
    </>
  );
}
