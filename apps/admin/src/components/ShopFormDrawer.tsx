import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { AdminShopSummary } from "@betng/contracts";
import { Button, Drawer, Input } from "@betng/ui-web";
import { useAdminAction } from "../hooks/queries";
import { shopSchema, type ShopValues } from "../lib/schemas";
import { adminSource } from "../services/sources";

const EMPTY: ShopValues = { code: "", name: "", address: "", phone: "", email: "", ownerName: "" };

export function ShopFormDrawer({ open, onClose, shop }: { readonly open: boolean; readonly onClose: () => void; readonly shop?: AdminShopSummary | undefined }): React.JSX.Element {
  const form = useForm<ShopValues>({ resolver: zodResolver(shopSchema), defaultValues: EMPTY, mode: "onTouched" });
  const { errors } = form.formState;
  const save = useAdminAction({
    run: (values: ShopValues) => (shop === undefined ? adminSource.createShop(values) : adminSource.updateShop(shop.id, values)),
    success: (saved) => (shop === undefined ? `${saved.code} created` : `${saved.code} updated`),
    onDone: onClose,
  });

  useEffect(() => {
    if (open) form.reset(shop === undefined ? EMPTY : { code: shop.code, name: shop.name, address: shop.address, phone: shop.phone, email: shop.email, ownerName: shop.ownerName });
  }, [open, shop, form]);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={shop === undefined ? "New shop" : `Edit ${shop.code}`}
      description={shop === undefined ? "The shop starts active with no cashiers and an empty float." : "Changes apply at once and are recorded in the audit log."}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="shop-form" loading={save.isPending} disabled={shop !== undefined && !form.formState.isDirty}>
            {shop === undefined ? "Create shop" : "Save changes"}
          </Button>
        </>
      }
    >
      <form
        id="shop-form"
        noValidate
        className="space-y-4"
        onSubmit={(event) => {
          void form.handleSubmit((values) => {
            save.mutate(values);
          })(event);
        }}
      >
        <Input label="Shop code" placeholder="BNG-LAG-005" readOnly={shop !== undefined} hint={shop === undefined ? "Printed on every ticket. Cannot be changed later." : "Shop codes are permanent."} error={errors.code?.message} {...form.register("code")} />
        <Input label="Shop name" error={errors.name?.message} {...form.register("name")} />
        <Input label="Address" error={errors.address?.message} {...form.register("address")} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Phone" type="tel" error={errors.phone?.message} {...form.register("phone")} />
          <Input label="Email" type="email" error={errors.email?.message} {...form.register("email")} />
        </div>
        <Input label="Owner" error={errors.ownerName?.message} {...form.register("ownerName")} />
      </form>
    </Drawer>
  );
}
