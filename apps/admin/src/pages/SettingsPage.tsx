import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { PlatformSettings } from "@betng/contracts";
import { Button, ConfirmDialog, ErrorState, Input, Panel, SkeletonRows, Switch, ThemeSwitcher } from "@betng/ui-web";
import { PageHeader } from "../components/PageHeader";
import { useAdminAction, useSettings } from "../hooks/queries";
import { useAdmin } from "../hooks/useAdmin";
import { settingsSchema, type SettingsValues } from "../lib/schemas";
import { adminSource } from "../services/sources";

const MONEY = ["minStake", "maxStake", "maxPayout", "exposureLimit"] as const;

function toForm(s: PlatformSettings): SettingsValues {
  return { ...s, minStake: s.minStake / 100, maxStake: s.maxStake / 100, maxPayout: s.maxPayout / 100, exposureLimit: s.exposureLimit / 100 };
}

function toPlatform(v: SettingsValues): PlatformSettings {
  return { ...v, ...Object.fromEntries(MONEY.map((key) => [key, Math.round(v[key] * 100)])) } as PlatformSettings;
}

export function SettingsPage(): React.JSX.Element {
  const { can } = useAdmin();
  const editable = can("settings:write");
  const settings = useSettings();
  const [pending, setPending] = useState<SettingsValues | undefined>();
  const form = useForm<SettingsValues>({ resolver: zodResolver(settingsSchema), mode: "onTouched" });
  const { errors, isDirty } = form.formState;
  const save = useAdminAction({
    run: (input: { readonly values: SettingsValues; readonly reason: string }) => adminSource.updateSettings(toPlatform(input.values), input.reason),
    success: () => "Platform settings updated",
    onDone: (saved) => {
      setPending(undefined);
      form.reset(toForm(saved));
    },
  });

  useEffect(() => {
    if (settings.data !== undefined && !isDirty) form.reset(toForm(settings.data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.data]);

  const number = { valueAsNumber: true } as const;

  return (
    <>
      <PageHeader title="Settings" description="Platform-wide limits and this console's appearance." />
      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Platform limits" description={editable ? "Changes apply to new bets at once and are audited as critical." : "Read-only for your role."} className="xl:col-span-2">
          {settings.data === undefined ? (
            settings.error !== null ? (
              <ErrorState error={settings.error} compact onRetry={() => void settings.refetch()} />
            ) : (
              <SkeletonRows rows={5} />
            )
          ) : (
            <form
              noValidate
              onSubmit={(event) => {
                void form.handleSubmit((values) => setPending(values))(event);
              }}
            >
              <fieldset disabled={!editable} className="grid gap-4 sm:grid-cols-2">
                <Input label="Minimum stake" prefix="₦" type="number" inputMode="decimal" error={errors.minStake?.message} {...form.register("minStake", number)} />
                <Input label="Maximum stake" prefix="₦" type="number" inputMode="decimal" error={errors.maxStake?.message} {...form.register("maxStake", number)} />
                <Input label="Maximum payout per bet" prefix="₦" type="number" inputMode="decimal" error={errors.maxPayout?.message} {...form.register("maxPayout", number)} />
                <Input label="Platform exposure limit" prefix="₦" type="number" inputMode="decimal" hint="Risk turns elevated at 55% and critical at 85%." error={errors.exposureLimit?.message} {...form.register("exposureLimit", number)} />
                <Input label="Maximum selections per bet" type="number" inputMode="numeric" error={errors.maxSelections?.message} {...form.register("maxSelections", number)} />
                <Input label="Betting closes before kick-off" type="number" inputMode="numeric" hint="Seconds" error={errors.bettingCloseSeconds?.message} {...form.register("bettingCloseSeconds", number)} />
                <Input label="Shop ticket expiry" type="number" inputMode="numeric" hint="Days a winning ticket can be claimed" error={errors.ticketExpiryDays?.message} {...form.register("ticketExpiryDays", number)} />
                <div className="sm:col-span-2">
                  <Switch checked={form.watch("maintenanceMode") ?? false} onChange={(checked) => form.setValue("maintenanceMode", checked, { shouldDirty: true })} disabled={!editable} label="Maintenance mode" description="Stops new bets on every channel. Live matches play out and settle as normal." />
                </div>
              </fieldset>
              {editable && (
                <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
                  <Button variant="ghost" disabled={!isDirty} onClick={() => settings.data !== undefined && form.reset(toForm(settings.data))}>
                    Discard
                  </Button>
                  <Button type="submit" disabled={!isDirty}>
                    Review changes
                  </Button>
                </div>
              )}
            </form>
          )}
        </Panel>
        <Panel title="Appearance" description="Stored on this device only.">
          <ThemeSwitcher showLabels />
        </Panel>
      </div>
      <ConfirmDialog
        open={pending !== undefined}
        onClose={() => !save.isPending && setPending(undefined)}
        title="Apply platform settings?"
        description="These limits take effect for every customer and shop immediately."
        confirmLabel="Apply settings"
        tone="danger"
        requireReason
        loading={save.isPending}
        onConfirm={(reason) => {
          if (pending !== undefined) save.mutate({ values: pending, reason });
        }}
      />
    </>
  );
}
