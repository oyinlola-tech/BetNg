import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConnectionStrip } from "../../src/ui/ConnectionStrip";
import { StaleBadge } from "../../src/ui/StaleBadge";

const secondsAgo = (seconds: number): string =>
  new Date(Date.now() - seconds * 1000).toISOString();

describe("ConnectionStrip", () => {
  it("renders nothing when connected and fresh", () => {
    const { container } = render(
      <ConnectionStrip state="CONNECTED" lastUpdatedAt={secondsAgo(2)} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it.each([
    ["CONNECTING", "Connecting to live updates"],
    ["RECONNECTING", "Reconnecting"],
    ["OFFLINE", "Connection lost"],
    ["FAILED", "Live updates are unavailable"],
  ] as const)("announces %s politely", (state, text) => {
    render(<ConnectionStrip state={state} />);

    const strip = screen.getByRole("status");

    expect(strip).toHaveAttribute("aria-live", "polite");
    expect(strip).toHaveTextContent(text);
  });

  it("shows when data was last updated", () => {
    render(<ConnectionStrip state="RECONNECTING" lastUpdatedAt={secondsAgo(12)} />);

    expect(screen.getByRole("status")).toHaveTextContent(/Last updated 1[23]s ago/);
  });

  it("calls out stale data while connected", () => {
    render(<ConnectionStrip state="CONNECTED" lastUpdatedAt={secondsAgo(90)} staleAfterMs={60_000} />);

    expect(screen.getByRole("status")).toHaveTextContent("Live updates have paused");
  });

  it("offers retry once the connection has failed", async () => {
    const onRetry = vi.fn();

    render(<ConnectionStrip state="FAILED" onRetry={onRetry} />);
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe("StaleBadge", () => {
  it("labels stale data with a word and its age", () => {
    render(<StaleBadge updatedAt={secondsAgo(40)} />);

    expect(screen.getByText(/Stale/)).toHaveTextContent(/Stale\s*· updated 4[01]s ago/);
  });

  it("stays hidden until the data is old enough", () => {
    const { container } = render(<StaleBadge updatedAt={secondsAgo(5)} staleAfterMs={30_000} />);

    expect(container).toBeEmptyDOMElement();
  });
});
