import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DataSourceError } from "@betng/ui-core";
import { renderConsole } from "../helpers/render";
import { customer, page } from "../helpers/rows";
import { SUPPORT_PERMISSIONS } from "../helpers/sources";

async function openCustomer(user: ReturnType<typeof userEvent.setup>): Promise<HTMLElement> {
  const table = await screen.findByRole("table", { name: "Customers" });

  await user.click(await within(table).findByText("Ada Obi"));

  return screen.findByRole("dialog", { name: "Ada Obi" });
}

describe("customer details", { timeout: 20_000 }, () => {
  it("edits the display name and phone only after confirmation with a reason", async () => {
    const user = userEvent.setup();
    const { adminSource } = renderConsole({ path: "/users", admin: { queryList: page([customer]), updateCustomer: { ...customer, displayName: "Ada O.", phone: "+234 801 234 5678" } } });
    const update = adminSource.calls("updateCustomer");

    await user.click(within(await openCustomer(user)).getByRole("button", { name: "Edit details" }));

    const drawer = await screen.findByRole("dialog", { name: "Edit Ada Obi" });

    expect(within(drawer).getByText(/Balances and wallet entries are not editable/)).toBeInTheDocument();
    expect(within(drawer).getByLabelText("Email")).toHaveAttribute("readonly");
    expect(within(drawer).queryByLabelText(/balance/i)).not.toBeInTheDocument();

    await user.clear(within(drawer).getByLabelText(/Display name/));
    await user.type(within(drawer).getByLabelText(/Display name/), "Ada O.");
    await user.type(within(drawer).getByLabelText("Phone"), "+234 801 234 5678");
    await user.click(within(drawer).getByRole("button", { name: "Review changes" }));

    const dialog = await screen.findByRole("dialog", { name: "Save changes to Ada Obi?" });
    const confirm = within(dialog).getByRole("button", { name: "Save details" });

    expect(confirm).toBeDisabled();

    await user.type(within(dialog).getByLabelText(/Reason/), "Customer asked by phone");
    await user.click(confirm);

    await waitFor(() => {
      expect(update).toHaveBeenCalledWith(customer.id, { displayName: "Ada O.", phone: "+234 801 234 5678", reason: "Customer asked by phone" });
    });
    expect(await screen.findByText("Ada O. updated")).toBeInTheDocument();
  });

  it("puts the platform's field errors back on the form", async () => {
    const user = userEvent.setup();
    const { adminSource } = renderConsole({
      path: "/users",
      admin: { queryList: page([customer]), updateCustomer: async () => Promise.reject(new DataSourceError("VALIDATION", "Check the fields.", { fields: { phone: "That number belongs to another account." } })) },
    });

    await user.click(within(await openCustomer(user)).getByRole("button", { name: "Edit details" }));

    const drawer = await screen.findByRole("dialog", { name: "Edit Ada Obi" });

    await user.type(within(drawer).getByLabelText("Phone"), "+234 801 234 5678");
    await user.click(within(drawer).getByRole("button", { name: "Review changes" }));

    const dialog = await screen.findByRole("dialog", { name: "Save changes to Ada Obi?" });

    await user.type(within(dialog).getByLabelText(/Reason/), "Customer asked");
    await user.click(within(dialog).getByRole("button", { name: "Save details" }));

    expect(await within(drawer).findByText("That number belongs to another account.")).toBeInTheDocument();
    expect(adminSource.calls("updateCustomer")).toHaveBeenCalledTimes(1);
  });

  it("sends a password reset only after confirmation with a reason", async () => {
    const user = userEvent.setup();
    const { adminSource } = renderConsole({ path: "/users", admin: { queryList: page([customer]), sendCustomerPasswordReset: undefined } });
    const reset = adminSource.calls("sendCustomerPasswordReset");

    await user.click(within(await openCustomer(user)).getByRole("button", { name: "Send password reset" }));

    const dialog = await screen.findByRole("dialog", { name: "Send a password reset?" });

    expect(reset).not.toHaveBeenCalled();

    await user.type(within(dialog).getByLabelText(/Reason/), "Locked out, verified by phone");
    await user.click(within(dialog).getByRole("button", { name: "Send password reset" }));

    await waitFor(() => {
      expect(reset).toHaveBeenCalledWith(customer.id, "Locked out, verified by phone");
    });
  });

  it("keeps edit and reset behind users:write", async () => {
    const user = userEvent.setup();

    renderConsole({ path: "/users", permissions: SUPPORT_PERMISSIONS, admin: { queryList: page([customer]) } });

    const drawer = await openCustomer(user);

    expect(within(drawer).getByRole("button", { name: "Edit details" })).toBeDisabled();
    expect(within(drawer).getByRole("button", { name: "Send password reset" })).toBeDisabled();
  });
});
