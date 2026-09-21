import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LiveMinute } from "../../src/components/LiveMinute";

describe("LiveMinute", () => {
  it("shows the minute the platform reported", () => {
    render(<LiveMinute clock={{ period: "SECOND_HALF", minute: 67, asOf: new Date().toISOString() }} />);

    expect(screen.getByText("67'")).toBeInTheDocument();
  });

  it("never invents a minute when the platform sent no clock", () => {
    render(<LiveMinute clock={undefined} />);

    expect(screen.getByText("LIVE")).toBeInTheDocument();
  });

  it("does not run past the end of the reported period", () => {
    const longAgo = new Date(Date.now() - 600_000).toISOString();

    render(<LiveMinute clock={{ period: "FIRST_HALF", minute: 40, asOf: longAgo, minuteLengthMs: 2000 }} />);

    expect(screen.getByText("45'")).toBeInTheDocument();
  });
});
