import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TicketScanner } from "../../src/components/TicketScanner";
import type { ScannerAdapter } from "../../src/services/scanner";

function fakeReader(): ScannerAdapter & { readonly scan: (code: string) => void } {
  let deliver: ((code: string) => void) | undefined;

  return {
    name: "Test reader",
    start: (onScan) => {
      deliver = onScan;

      return () => {
        deliver = undefined;
      };
    },
    scan: (code) => {
      deliver?.(code);
    },
  };
}

describe("ticket entry", () => {
  it("tabs from the ticket field to its action and nowhere in between", async () => {
    const user = userEvent.setup();

    render(
      <>
        <button type="button">Before</button>
        <TicketScanner label="Ticket number" actionLabel="Check" onSubmit={vi.fn()} adapter={fakeReader()} />
        <button type="button">After</button>
      </>,
    );

    const field = screen.getByRole("textbox", { name: "Ticket number" });

    expect(field).toHaveFocus();
    expect(field).toHaveAccessibleDescription(/scan the barcode/);

    await user.tab();
    expect(screen.getByRole("button", { name: "Check" })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();

    await user.tab({ shift: true });
    await user.tab({ shift: true });
    expect(field).toHaveFocus();

    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Before" })).toHaveFocus();
  });

  it("submits a typed code with Enter", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<TicketScanner label="Ticket number" actionLabel="Check" onSubmit={onSubmit} adapter={fakeReader()} />);

    await user.keyboard("bng-7k2qx9{Enter}");
    expect(onSubmit).toHaveBeenCalledWith("BNG-7K2QX9");
  });

  it("announces a scan to assistive technology", () => {
    const reader = fakeReader();
    const onSubmit = vi.fn();

    render(<TicketScanner label="Ticket number" actionLabel="Check" onSubmit={onSubmit} adapter={reader} />);

    act(() => {
      reader.scan("BNG-7K2QX9");
    });

    expect(onSubmit).toHaveBeenCalledWith("BNG-7K2QX9");
    expect(screen.getByRole("status")).toHaveTextContent("Scanned BNG-7K2QX9");
  });
});
