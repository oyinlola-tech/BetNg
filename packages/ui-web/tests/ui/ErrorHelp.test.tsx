import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DataSourceError } from "@betng/ui-core";
import { ErrorHelpProvider, ErrorState, FormError, errorHelpTopic } from "../../src";

const help = { hrefFor: (topic: string) => `/help#${topic}` };

describe("error help", () => {
  it("adds a help link only inside a provider and only for codes with an explanation", () => {
    const { rerender } = render(<ErrorState error={new DataSourceError("ODDS_CHANGED", "moved")} />);

    expect(screen.queryByRole("link")).toBeNull();

    rerender(
      <ErrorHelpProvider value={help}>
        <ErrorState error={new DataSourceError("ODDS_CHANGED", "moved")} />
        <ErrorState error={new DataSourceError("NOT_FOUND", "gone")} />
      </ErrorHelpProvider>,
    );

    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Why did the odds change?" })).toHaveAttribute("href", "/help#odds-changed");
    expect(errorHelpTopic("NOT_FOUND")).toBeUndefined();
  });

  it("offers a retry on a failed read only when the failure is retryable", async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    const { rerender } = render(<FormError error={new DataSourceError("TIMEOUT", "slow")} onRetry={retry} />);

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledTimes(1);

    rerender(<FormError error={new DataSourceError("VALIDATION", "bad")} onRetry={retry} />);
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });
});
