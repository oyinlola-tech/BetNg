import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BottomSheet } from "../../src/ui/BottomSheet";
import { ConfirmationDialog } from "../../src/ui/ConfirmationDialog";
import { Dialog } from "../../src/ui/Dialog";

function Harness({ dismissible = true }: { readonly dismissible?: boolean }): React.JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
      >
        Open
      </button>
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
        }}
        title="Deposit"
        description="Add funds to your wallet."
        dismissible={dismissible}
      >
        <input aria-label="Amount" />
      </Dialog>
    </>
  );
}

describe("Dialog", () => {
  it("opens as a labelled, described modal dialog", async () => {
    render(<Harness />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Open" }));

    const dialog = screen.getByRole("dialog", { name: "Deposit" });

    expect(dialog).toHaveAttribute("open");
    expect(dialog).toHaveAccessibleDescription("Add funds to your wallet.");
  });

  it("closes on Escape and returns focus to the opener", async () => {
    render(<Harness />);

    const opener = screen.getByRole("button", { name: "Open" });

    await userEvent.click(opener);
    await userEvent.click(screen.getByRole("textbox", { name: "Amount" }));
    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("closes from the close button and on a backdrop click", async () => {
    render(<Harness />);

    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    await userEvent.click(screen.getByRole("dialog"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("ignores Escape and the backdrop when not dismissible", async () => {
    render(<Harness dismissible={false} />);

    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    await userEvent.click(screen.getByRole("textbox", { name: "Amount" }));
    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByRole("dialog"));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
  });
});

describe("ConfirmationDialog", () => {
  it("confirms straight away when no reason is needed", async () => {
    const onConfirm = vi.fn();

    render(
      <ConfirmationDialog
        open
        onClose={() => undefined}
        onConfirm={onConfirm}
        title="Cancel ticket"
        description="The stake is returned."
        confirmLabel="Cancel ticket"
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Cancel ticket" }));

    expect(onConfirm).toHaveBeenCalledWith("");
  });

  it("requires a written reason when configured", async () => {
    const onConfirm = vi.fn();

    render(
      <ConfirmationDialog
        open
        onClose={() => undefined}
        onConfirm={onConfirm}
        title="Suspend shop"
        description="Cashiers are signed out."
        confirmLabel="Suspend"
        tone="danger"
        requireReason
      />,
    );

    const confirm = screen.getByRole("button", { name: "Suspend" });

    expect(confirm).toBeDisabled();

    await userEvent.type(screen.getByRole("textbox", { name: "Reason" }), "  Float mismatch ");

    expect(confirm).toBeEnabled();

    await userEvent.click(confirm);

    expect(onConfirm).toHaveBeenCalledWith("Float mismatch");
  });

  it("cancels through onClose and cannot be dismissed while loading", async () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <ConfirmationDialog
        open
        onClose={onClose}
        onConfirm={() => undefined}
        title="Suspend shop"
        description="Cashiers are signed out."
        confirmLabel="Suspend"
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(
      <ConfirmationDialog
        open
        loading
        onClose={onClose}
        onConfirm={() => undefined}
        title="Suspend shop"
        description="Cashiers are signed out."
        confirmLabel="Suspend"
      />,
    );

    await userEvent.click(screen.getByRole("dialog"));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });
});

describe("BottomSheet", () => {
  it("renders a labelled dialog capped at 85dvh", () => {
    render(
      <BottomSheet open onClose={() => undefined} title="Bet slip">
        Slip
      </BottomSheet>,
    );

    expect(screen.getByRole("dialog", { name: "Bet slip" })).toHaveClass("max-h-[85dvh]");
  });
});
