import "@testing-library/jest-dom/vitest";
import { StrictMode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Dialog } from "../../src";

describe("a dialog mounted already open under StrictMode", () => {
  it("stays open: its own effect cleanup is not taken for the user closing it", () => {
    const onClose = vi.fn();

    render(
      <StrictMode>
        <Dialog open onClose={onClose} title="Search">
          <input placeholder="Search BETNG" />
        </Dialog>
      </StrictMode>,
    );

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText("Search BETNG")).toBeInTheDocument();
  });

  it("still reports a real close from the user", async () => {
    const onClose = vi.fn();

    render(
      <StrictMode>
        <Dialog open onClose={onClose} title="Search">
          <input placeholder="Search BETNG" />
        </Dialog>
      </StrictMode>,
    );

    expect(onClose).not.toHaveBeenCalled();

    await userEvent.click(screen.getByPlaceholderText("Search BETNG"));
    await userEvent.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("puts focus in the first field, or the marked element, rather than on the close button", () => {
    const { unmount } = render(
      <Dialog open onClose={() => undefined} title="Search">
        <input placeholder="Search BETNG" />
      </Dialog>,
    );

    expect(screen.getByPlaceholderText("Search BETNG")).toHaveFocus();
    unmount();

    render(
      <Dialog open onClose={() => undefined} title="Confirm">
        <input placeholder="Reason" />
        <button type="button" data-autofocus>
          Keep it
        </button>
      </Dialog>,
    );

    expect(screen.getByRole("button", { name: "Keep it" })).toHaveFocus();
  });
});
