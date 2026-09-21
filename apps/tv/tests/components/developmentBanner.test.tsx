import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DevelopmentBanner } from "../../src/components/DevelopmentBanner";

describe("TV development banner", () => {
  it("labels stand-in data without adding anything the remote can land on", () => {
    const { container } = render(<DevelopmentBanner />);

    expect(screen.getByRole("status")).toHaveTextContent("Development data");
    expect(container.querySelector("[data-tv-focusable], button, a, [tabindex]")).toBeNull();
  });
});
