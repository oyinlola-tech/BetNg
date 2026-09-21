import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "../../src/ui/Button";
import type { ButtonVariant } from "../../src/ui/Button";
import { IconButton } from "../../src/ui/IconButton";

const VARIANTS: readonly ButtonVariant[] = [
  "primary",
  "secondary",
  "outline",
  "ghost",
  "danger",
  "success",
  "link",
];

describe("Button", () => {
  it.each(VARIANTS)("renders the %s variant", (variant) => {
    render(<Button variant={variant}>Place bet</Button>);

    const button = screen.getByRole("button", { name: "Place bet" });

    expect(button).toHaveAttribute("data-variant", variant);
    expect(button).toHaveAttribute("type", "button");
  });

  it("maps sizes to the control heights", () => {
    render(
      <>
        <Button size="xs">xs</Button>
        <Button size="sm">sm</Button>
        <Button size="md">md</Button>
        <Button size="lg">lg</Button>
      </>,
    );

    expect(screen.getByRole("button", { name: "xs" })).toHaveClass("h-6");
    expect(screen.getByRole("button", { name: "sm" })).toHaveClass("h-8");
    expect(screen.getByRole("button", { name: "md" })).toHaveClass("h-10");
    expect(screen.getByRole("button", { name: "lg" })).toHaveClass("h-12");
  });

  it("calls onClick", async () => {
    const onClick = vi.fn();

    render(<Button onClick={onClick}>Save</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("is disabled and busy while loading", async () => {
    const onClick = vi.fn();

    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Save" });

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");

    await userEvent.click(button);

    expect(onClick).not.toHaveBeenCalled();
  });

  it("renders leading and trailing icons and stretches with fullWidth", () => {
    render(
      <Button
        fullWidth
        leadingIcon={<span data-testid="lead" />}
        trailingIcon={<span data-testid="trail" />}
      >
        Next
      </Button>,
    );

    expect(screen.getByTestId("lead")).toBeInTheDocument();
    expect(screen.getByTestId("trail")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toHaveClass("w-full");
  });

  it("keeps the earlier icon and full props working", () => {
    render(
      <Button full icon={<span data-testid="legacy" />} type="submit">
        Sign in
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Sign in" });

    expect(button).toHaveClass("w-full");
    expect(button).toHaveAttribute("type", "submit");
    expect(screen.getByTestId("legacy")).toBeInTheDocument();
  });
});

describe("IconButton", () => {
  it("takes its accessible name from label", () => {
    render(
      <IconButton label="Refresh odds">
        <svg />
      </IconButton>,
    );

    expect(screen.getByRole("button", { name: "Refresh odds" })).toHaveAttribute(
      "title",
      "Refresh odds",
    );
  });

  it("shows a tooltip and describes the button when the tip adds meaning", () => {
    render(
      <IconButton label="Void ticket" tooltip="Voids the ticket and refunds the stake">
        <svg />
      </IconButton>,
    );

    const button = screen.getByRole("button", { name: "Void ticket" });
    const tip = screen.getByRole("tooltip", { hidden: true });

    expect(button).not.toHaveAttribute("title");
    expect(button).toHaveAttribute("aria-describedby", tip.id);
  });

  it("supports the disabled state", () => {
    render(
      <IconButton label="Next page" disabled>
        <svg />
      </IconButton>,
    );

    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  });
});
