import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderConsole } from "../helpers/render";
import { customer, page } from "../helpers/rows";
import { SUPPORT_PERMISSIONS } from "../helpers/sources";

async function openCustomer(user: ReturnType<typeof userEvent.setup>): Promise<HTMLElement> {
  const table = await screen.findByRole("table", { name: "Customers" });

  await user.click(await within(table).findByText("Ada Obi"));

  return screen.findByRole("dialog", { name: "Ada Obi" });
}

describe("admin actions", () => {
  it("disables an action the session cannot perform and names the missing permission", async () => {
    const user = userEvent.setup();
    const { adminSource } = renderConsole({ path: "/users", permissions: SUPPORT_PERMISSIONS, admin: { queryList: page([customer]) } });
    const drawer = await openCustomer(user);
    const button = within(drawer).getByRole("button", { name: "Suspend customer" });

    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription("Requires the “users:write” permission");
    expect(adminSource.calls("setCustomerStatus")).not.toHaveBeenCalled();
  });

  it("calls the source for a destructive action only after confirmation with a reason", async () => {
    const user = userEvent.setup();
    const { adminSource } = renderConsole({ path: "/users", admin: { queryList: page([customer]), setCustomerStatus: { ...customer, status: "SUSPENDED" } } });
    const drawer = await openCustomer(user);
    const setStatus = adminSource.calls("setCustomerStatus");

    await user.click(within(drawer).getByRole("button", { name: "Suspend customer" }));

    const dialog = await screen.findByRole("dialog", { name: "Suspend this customer?" });
    const confirm = within(dialog).getByRole("button", { name: "Suspend customer" });

    expect(setStatus).not.toHaveBeenCalled();
    expect(confirm).toBeDisabled();

    await user.type(within(dialog).getByLabelText(/Reason/), "abc");
    expect(confirm).toBeDisabled();

    await user.type(within(dialog).getByLabelText(/Reason/), " duplicate account");
    expect(confirm).toBeEnabled();
    expect(setStatus).not.toHaveBeenCalled();

    await user.click(confirm);

    await waitFor(() => {
      expect(setStatus).toHaveBeenCalledWith(customer.id, "SUSPENDED", "abc duplicate account");
    });
  });

  it("cancelling the confirmation calls nothing", async () => {
    const user = userEvent.setup();
    const { adminSource } = renderConsole({ path: "/users", admin: { queryList: page([customer]) } });
    const drawer = await openCustomer(user);

    await user.click(within(drawer).getByRole("button", { name: "Suspend customer" }));
    await user.click(within(await screen.findByRole("dialog", { name: "Suspend this customer?" })).getByRole("button", { name: "Cancel" }));

    expect(adminSource.calls("setCustomerStatus")).not.toHaveBeenCalled();
  });
});
