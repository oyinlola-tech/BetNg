import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { AdminShopSummary } from "@betng/contracts";
import { Button, ConfirmationDialog, Drawer, FormError, applyFieldErrors } from "@betng/ui-web";
import { useAdminAction } from "../hooks/queries";
import { shopSchema, type ShopValues } from "../lib/schemas";
import { adminSource } from "../services/runtime";
import { TextField } from "./form/TextField";
import { UnsavedChangesDialog } from "./UnsavedChangesDialog";

const EMPTY: ShopValues = { code: "", name: "", address: "", phone: "", email: "", ownerName: "" };
const FIELDS = ["code", "name", "address", "phone", "email", "ownerName"] as const;

export function ShopFormDrawer({ open, onClose, shop }: { readonly open: boolean; readonly onClose: () => void; readonly shop?: AdminShopSummary | undefined }): React.JSX.Element {
  const form = useForm<ShopValues>({ resolver: zodResolver(shopSchema), defaultValues: EMPTY, mode: "onTouched" });
  const { errors, isDirty } = form.formState;
  const [pending, setPending] = useState<ShopValues | undefined>();
  const [discarding, setDiscarding] = useState(false);
  const [failure, setFailure] = useState<unknown>();
  const editing = shop !== undefined;

  const save = useAdminAction({
    run: (values: ShopValues) => (shop === undefined ? adminSource.createShop(values) : adminSource.updateShop(shop.id, values)),
    success: (saved) => (editing ? `${saved.code} updated` : `${saved.code} created`),
    silentError: true,
    onDone: () => {
      setPending(undefined);
      form.reset(EMPTY);
      onClose();
    },
  });

  useEffect(() => {
    if (!open) return;

    setFailure(undefined);
    form.reset(shop === undefined ? EMPTY : { code: shop.code, name: shop.name, address: shop.address, phone: shop.phone, email: shop.email, ownerName: shop.ownerName });
  }, [open, shop, form]);

  const requestClose = (): void => {
    if (isDirty) setDiscarding(true);
    else onClose();
  };

  return (
    <>
      <Drawer
        open={open}
        onClose={requestClose}
        title={editing ? `Edit ${shop.code}` : "New shop"}
        description={editing ? "Changes apply at once and the platform records them in the audit log." : "The shop starts active with no cashiers and an empty float."}
        footer={
          <>
            <Button variant="ghost" onClick={requestClose} disabled={save.isPending}>
              Cancel
            </Button>
            <Button variant="ghost" disabled={!isDirty || save.isPending} onClick={() => form.reset()}>
              Reset
            </Button>
            <Button type="submit" form="shop-form" loading={save.isPending} disabled={!isDirty}>
              {editing ? "Review changes" : "Review shop"}
            </Button>
          </>
        }
      >
        <form
          id="shop-form"
          noValidate
          aria-label={editing ? "Edit shop" : "New shop"}
          className="space-y-4"
          onSubmit={(event) => {
            void form.handleSubmit((values) => {
              setFailure(undefined);
              setPending(values);
            })(event);
          }}
        >
          <FormError error={failure} />
          <TextField label="Shop code" required readOnly={editing} hint={editing ? "Shop codes are permanent." : "Printed on every ticket. Cannot be changed later."} error={errors.code?.message} {...form.register("code")} />
          <TextField label="Shop name" required error={errors.name?.message} {...form.register("name")} />
          <TextField label="Address" required error={errors.address?.message} {...form.register("address")} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Phone" type="tel" required error={errors.phone?.message} {...form.register("phone")} />
            <TextField label="Email" type="email" required error={errors.email?.message} {...form.register("email")} />
          </div>
          <TextField label="Owner" required error={errors.ownerName?.message} {...form.register("ownerName")} />
        </form>
      </Drawer>

      <ConfirmationDialog
        open={pending !== undefined}
        onClose={() => {
          if (!save.isPending) setPending(undefined);
        }}
        title={editing ? `Save changes to ${shop.code}?` : `Create ${pending?.code ?? "this shop"}?`}
        description={editing ? "The shop's details change for every cashier and on new tickets straight away." : "A new retail location is added to the platform and can be given cashiers."}
        confirmLabel={editing ? "Save shop" : "Create shop"}
        loading={save.isPending}
        onConfirm={async () => {
          if (pending === undefined) return;

          try {
            await save.mutateAsync(pending);
          } catch (error) {
            applyFieldErrors(error, form.setError, FIELDS);
            setFailure(error);
            setPending(undefined);
          }
        }}
      />
      <ConfirmationDialog
        open={discarding}
        onClose={() => setDiscarding(false)}
        onConfirm={() => {
          setDiscarding(false);
          form.reset(EMPTY);
          onClose();
        }}
        title="Discard this form?"
        description="What you have typed has not been saved."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        tone="danger"
      />
      <UnsavedChangesDialog dirty={open && isDirty} />
    </>
  );
}
