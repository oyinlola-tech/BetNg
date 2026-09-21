import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider, useToast } from "../../src/providers/ToastProvider";
import type { ToastInput } from "../../src/providers/ToastProvider";

function Trigger({ input }: { readonly input: ToastInput }): React.JSX.Element {
  const { toast } = useToast();

  return (
    <button
      type="button"
      onClick={() => {
        toast(input);
      }}
    >
      Notify
    </button>
  );
}

function show(input: ToastInput): void {
  render(
    <ToastProvider>
      <Trigger input={input} />
    </ToastProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Notify" }));
}

// jsdom has no Popover API, so its stylesheet keeps the `popover` region hidden; browsers open it.
const HIDDEN = { hidden: true } as const;

afterEach(() => {
  vi.useRealTimers();
});

describe("Toast", () => {
  it("renders title and message in a polite status", () => {
    show({ title: "Bet accepted", message: "Ticket BN-1042", tone: "success", kind: "bet" });

    const toast = screen.getByRole("status", HIDDEN);

    expect(toast).toHaveTextContent("Bet accepted");
    expect(toast).toHaveTextContent("Ticket BN-1042");
    expect(toast).toHaveAttribute("aria-live", "polite");
    expect(toast).toHaveAttribute("data-tone", "success");
  });

  it("announces errors assertively", () => {
    show({ title: "Withdrawal failed", tone: "error" });

    expect(screen.getByRole("alert", HIDDEN)).toHaveAttribute("aria-live", "assertive");
  });

  it("treats the danger tone as error", () => {
    show({ title: "Withdrawal failed", tone: "danger" });

    expect(screen.getByRole("alert", HIDDEN)).toHaveAttribute("data-tone", "error");
  });

  it.each(["info", "warning", "system"] as const)("renders the %s tone as a status", (tone) => {
    show({ title: "Heads up", tone });

    expect(screen.getByRole("status", HIDDEN)).toHaveAttribute("data-tone", tone);
  });

  it("dismisses from its labelled button", () => {
    show({ title: "Bet accepted" });

    fireEvent.click(screen.getByRole("button", { name: "Dismiss notification", hidden: true }));

    expect(screen.queryByRole("status", HIDDEN)).not.toBeInTheDocument();
  });

  it("auto-dismisses, and pauses while hovered", () => {
    vi.useFakeTimers();
    show({ title: "Bet accepted", duration: 1000 });

    const toast = screen.getByRole("status", HIDDEN);

    fireEvent.mouseEnter(toast);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByRole("status", HIDDEN)).toBeInTheDocument();

    fireEvent.mouseLeave(toast);
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(screen.queryByRole("status", HIDDEN)).not.toBeInTheDocument();
  });

  it("shows at most four toasts", () => {
    show({ title: "Goal" });

    for (let i = 0; i < 5; i += 1)
      fireEvent.click(screen.getByRole("button", { name: "Notify" }));

    expect(screen.getAllByRole("status", HIDDEN)).toHaveLength(4);
  });
});
