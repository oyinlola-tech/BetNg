import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { PlatformSettings } from "@betng/contracts";
import { ConfirmationDialog, ErrorState, FormActions, FormError, Panel, SkeletonRows, Switch, ThemeSwitcher, applyFieldErrors } from "@betng/ui-web";
import { MoneyField, TextField } from "../components/form/TextField";
import { GuardedButton } from "../components/Guard";
import { PageHeader } from "../components/PageHeader";
import { UnsavedChangesDialog } from "../components/UnsavedChangesDialog";
import { useAdminAction, useSettings } from "../hooks/queries";
import { useAdmin } from "../hooks/useAdmin";
import { keys } from "../lib/queryKeys";
import { settingsSchema, toMinor, toMoneyText, type SettingsValues } from "../lib/schemas";
import { adminSource } from "../services/runtime";

const FIELDS = ["minStake", "maxStake", "maxPayout", "exposureLimit", "maxSelections", "bettingCloseSeconds", "ticketExpiryDays", "maintenanceMode"] as const;

function toForm(s: PlatformSettings): SettingsValues {
  return { ...s, minStake: toMoneyText(s.minStake), maxStake: toMoneyText(s.maxStake), maxPayout: toMoneyText(s.maxPayout), exposureLimit: toMoneyText(s.exposureLimit) };
}

function toPlatform(v: SettingsValues): PlatformSettings {
  return { ...v, minStake: toMinor(v.minStake), maxStake: toMinor(v.maxStake), maxPayout: toMinor(v.maxPayout), exposureLimit: toMinor(v.exposureLimit) };
}

function SettingsForm({ settings }: { readonly settings: PlatformSettings }): React.JSX.Element {
  const { can } = useAdmin();
  const editable = can("settings:write");
  const [pending, setPending] = useState<SettingsValues | undefined>();
  const [failure, setFailure] = useState<unknown>();
  const form = useForm<SettingsValues>({ resolver: zodResolver(settingsSchema), defaultValues: toForm(settings), mode: "onTouched" });
  const { errors, isDirty } = form.formState;
  const save = useAdminAction({
    run: (input: { readonly values: SettingsValues; readonly reason: string }) => adminSource.updateSettings(toPlatform(input.values), input.reason),
    success: () => "Platform settings updated",
    invalidate: [keys.settings],
    silentError: true,
    onDone: (saved) => {
      setPending(undefined);
      form.reset(toForm(saved));
    },
  });

  useEffect(() => {
    if (!isDirty) form.reset(toForm(settings));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const whole = { valueAsNumber: true } as const;

  return (
    <>
      <form
        noValidate
        aria-label="Platform limits"
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
        <FormError error={failure} className="mb-4" />
        <fieldset disabled={!editable} className="grid gap-4 sm:grid-cols-2">
          <MoneyField label="Minimum stake" required error={errors.minStake?.message} {...form.register("minStake")} />
          <MoneyField label="Maximum stake" required error={errors.maxStake?.message} {...form.register("maxStake")} />
          <MoneyField label="Maximum payout per bet" required error={errors.maxPayout?.message} {...form.register("maxPayout")} />
          <MoneyField label="Platform exposure limit" required hint="The risk service judges exposure against it." error={errors.exposureLimit?.message} {...form.register("exposureLimit")} />
          <TextField label="Maximum selections per bet" type="number" inputMode="numeric" required error={errors.maxSelections?.message} {...form.register("maxSelections", whole)} />
          <TextField label="Betting closes before kick-off" type="number" inputMode="numeric" required hint="Seconds" error={errors.bettingCloseSeconds?.message} {...form.register("bettingCloseSeconds", whole)} />
          <TextField label="Shop ticket expiry" type="number" inputMode="numeric" required hint="Days a winning ticket can be claimed" error={errors.ticketExpiryDays?.message} {...form.register("ticketExpiryDays", whole)} />
          <div className="sm:col-span-2">
            <Switch checked={form.watch("maintenanceMode")} onChange={(checked) => form.setValue("maintenanceMode", checked, { shouldDirty: true })} disabled={!editable} label="Maintenance mode" description="Stops new bets on every channel. Live matches play out and settle as normal." />
          </div>
        </fieldset>
        <div className="mt-5 border-t border-border pt-4">
          {editable ? (
            <FormActions submitLabel="Review changes" dirty={isDirty} loading={save.isPending} onReset={() => form.reset(toForm(settings))} />
          ) : (
            <div className="flex justify-end">
              <GuardedButton permission="settings:write">Review changes</GuardedButton>
            </div>
          )}
        </div>
      </form>
      <ConfirmationDialog
        open={pending !== undefined}
        onClose={() => {
          if (!save.isPending) setPending(undefined);
        }}
        title="Apply platform settings?"
        description="These limits take effect for every customer and shop immediately."
        confirmLabel="Apply settings"
        tone="danger"
        requireReason
        loading={save.isPending}
        onConfirm={async (reason) => {
          if (pending === undefined) return;

          try {
            await save.mutateAsync({ values: pending, reason });
          } catch (error) {
            applyFieldErrors(error, form.setError, FIELDS);
            setFailure(error);
            setPending(undefined);
          }
        }}
      />
      <UnsavedChangesDialog dirty={isDirty} />
    </>
  );
}

export function SettingsPage(): React.JSX.Element {
  const { can } = useAdmin();
  const settings = useSettings();

  return (
    <>
      <PageHeader title="Settings" description="Platform-wide limits and this console's appearance." />
      <div className="grid items-start gap-4 xl:grid-cols-3">
        <Panel title="Platform limits" description={can("settings:write") ? "Changes apply to new bets at once and are audited as critical." : "Read-only for your role."} className="xl:col-span-2">
          {settings.data === undefined ? settings.error !== null ? <ErrorState error={settings.error} compact onRetry={() => void settings.refetch()} /> : <SkeletonRows rows={6} /> : <SettingsForm settings={settings.data} />}
        </Panel>
        <Panel title="Appearance" description="Stored on this device only.">
          <ThemeSwitcher showLabels />
        </Panel>
      </div>
    </>
  );
}
