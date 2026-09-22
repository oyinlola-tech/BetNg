import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { AdminCustomer, AdminUpdateCustomerRequest } from "@betng/contracts";
import { Button, ConfirmationDialog, Drawer, FormError, applyFieldErrors } from "@betng/ui-web";
import { useAdminAction } from "../hooks/queries";
import { customerDetailsSchema, type CustomerDetailsValues } from "../lib/schemas";
import { adminSource } from "../services/runtime";
import { TextField } from "./form/TextField";
import { UnsavedChangesDialog } from "./UnsavedChangesDialog";

type Changes = Omit<AdminUpdateCustomerRequest, "reason">;

function changesFrom(values: CustomerDetailsValues, customer: AdminCustomer): Changes | undefined {
  const displayName = values.displayName.trim();
  const phone = values.phone.trim();
  const changes = {
    ...(displayName === customer.displayName ? {} : { displayName }),
    ...(phone === "" || phone === (customer.phone ?? "") ? {} : { phone }),
  };

  return Object.keys(changes).length === 0 ? undefined : changes;
}

export function CustomerEditDrawer({ customer, onClose }: { readonly customer: AdminCustomer | undefined; readonly onClose: () => void }): React.JSX.Element {
  const open = customer !== undefined;
  const form = useForm<CustomerDetailsValues>({ resolver: zodResolver(customerDetailsSchema), defaultValues: { displayName: "", phone: "" }, mode: "onTouched" });
  const { errors, isDirty } = form.formState;
  const [pending, setPending] = useState<Changes | undefined>();
  const [failure, setFailure] = useState<unknown>();

  const save = useAdminAction({
    run: (input: { readonly id: string; readonly request: AdminUpdateCustomerRequest }) => adminSource.updateCustomer(input.id, input.request),
    success: (saved) => `${saved.displayName} updated`,
    silentError: true,
    onDone: () => {
      setPending(undefined);
      onClose();
    },
  });

  useEffect(() => {
    if (customer === undefined) return;

    setFailure(undefined);
    form.reset({ displayName: customer.displayName, phone: customer.phone ?? "" });
  }, [customer, form]);

  return (
    <>
      <Drawer
        open={open}
        onClose={() => {
          if (!save.isPending) onClose();
        }}
        title={customer === undefined ? "Edit details" : `Edit ${customer.displayName}`}
        description="Changes apply at once and the platform records them, with your reason, in the audit log."
        footer={
          <>
            <Button variant="ghost" onClick={onClose} disabled={save.isPending}>
              Cancel
            </Button>
            <Button type="submit" form="customer-form" loading={save.isPending} disabled={!isDirty}>
              Review changes
            </Button>
          </>
        }
      >
        {customer !== undefined && (
          <form
            id="customer-form"
            noValidate
            aria-label="Edit customer details"
            className="space-y-4"
            onSubmit={(event) => {
              void form.handleSubmit((values) => {
                setFailure(undefined);

                if (values.phone.trim() === "" && customer.phone !== undefined) {
                  form.setError("phone", { type: "manual", message: "A phone number can't be removed here. Enter a new one instead." });

                  return;
                }

                const changes = changesFrom(values, customer);

                if (changes === undefined) {
                  form.setError("root", { type: "manual", message: "Nothing has changed." });

                  return;
                }

                setPending(changes);
              })(event);
            }}
          >
            <FormError error={failure} />
            {errors.root?.message !== undefined && (
              <p role="alert" className="text-sm font-medium text-danger">
                {errors.root.message}
              </p>
            )}
            <TextField label="Display name" required autoComplete="off" error={errors.displayName?.message} {...form.register("displayName")} />
            <TextField label="Phone" type="tel" autoComplete="off" error={errors.phone?.message} {...form.register("phone")} />
            <TextField label="Email" type="email" value={customer.email} readOnly hint="The customer changes their email address through a verified flow; it cannot be edited here." />
            <div className="rounded-md border border-border bg-surface-sunken p-3 text-sm text-text-secondary">
              Balances and wallet entries are not editable. They come from the platform's ledger, and no wallet adjustment is available from this console.
            </div>
          </form>
        )}
      </Drawer>

      <ConfirmationDialog
        open={pending !== undefined}
        onClose={() => {
          if (!save.isPending) setPending(undefined);
        }}
        title={`Save changes to ${customer?.displayName ?? "this customer"}?`}
        description={[pending?.displayName === undefined ? undefined : `Display name becomes ${pending.displayName}.`, pending?.phone === undefined ? undefined : `Phone becomes ${pending.phone}.`].filter((line) => line !== undefined).join(" ")}
        confirmLabel="Save details"
        requireReason
        loading={save.isPending}
        onConfirm={async (reason) => {
          if (pending === undefined || customer === undefined) return;

          try {
            await save.mutateAsync({ id: customer.id, request: { ...pending, reason: reason.trim() } });
          } catch (error) {
            const { applied, unmatched } = applyFieldErrors(error, form.setError, ["displayName", "phone"]);

            setFailure(applied.length > 0 && Object.keys(unmatched).length === 0 ? undefined : error);
            setPending(undefined);
          }
        }}
      />
      <UnsavedChangesDialog dirty={open && isDirty && !save.isPending} />
    </>
  );
}
