import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { OddsButton } from "../../src/markets/OddsButton";
import { selection } from "./fixtures";

describe("OddsButton", () => {
  it("names itself with context, label and price, and reports selection", async () => {
    const onSelect = vi.fn();

    render(<OddsButton label="One" odds={2.1} accessibleContext="Ashford City v Riverside, Fixture market A" onSelect={onSelect} />);

    const button = screen.getByRole("button", { name: "Ashford City v Riverside, Fixture market A, One, odds 2.10" });

    expect(button).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(button);
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it("is pressed when selected", () => {
    render(<OddsButton label="One" odds={2.1} state="selected" />);

    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });

  it("cannot be clicked while suspended and says so", async () => {
    const onSelect = vi.fn();

    render(<OddsButton label="One" odds={2.1} state="suspended" onSelect={onSelect} />);

    const button = screen.getByRole("button", { name: "One, suspended" });

    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onSelect).not.toHaveBeenCalled();
    expect(button).not.toHaveTextContent("2.10");
  });

  it("shows a dash when unavailable or unpriced, and a skeleton while loading", () => {
    const { rerender } = render(<OddsButton label="One" odds={2.1} state="unavailable" />);

    expect(screen.getByRole("button", { name: "One, unavailable" })).toBeDisabled();
    expect(screen.getByRole("button")).toHaveTextContent("–");

    rerender(<OddsButton label="One" />);
    expect(screen.getByRole("button", { name: "One, unavailable" })).toBeDisabled();

    rerender(<OddsButton label="One" state="loading" />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("highlights a price that changed between renders, in the right direction", () => {
    const { rerender } = render(<OddsButton label="One" odds={2.1} />);
    const button = screen.getByRole("button");

    expect(button).not.toHaveAttribute("data-change");
    expect(button.querySelector(".animate-odds-up, .animate-odds-down")).toBeNull();

    rerender(<OddsButton label="One" odds={2.4} />);
    expect(button).toHaveAttribute("data-change", "UP");
    expect(button).toHaveAccessibleName("One, odds 2.40, price up");
    expect(button.querySelector(".animate-odds-up")).not.toBeNull();

    rerender(<OddsButton label="One" odds={1.9} />);
    expect(button).toHaveAttribute("data-change", "DOWN");
    expect(button.querySelector(".animate-odds-down")).not.toBeNull();
    expect(button.querySelector(".animate-odds-up")).toBeNull();
  });

  it("shows a movement the platform reported", () => {
    render(<OddsButton label="One" odds={2.1} change="DOWN" />);

    expect(screen.getByRole("button")).toHaveAttribute("data-change", "DOWN");
  });

  it("keeps the legacy selection props working", async () => {
    const onToggle = vi.fn();
    const legacy = selection("sel-1", "Legacy pick", 1.75, { trend: "UP" });

    render(<OddsButton selection={legacy} selected compact onToggle={onToggle} />);

    const button = screen.getByRole("button", { name: "Leg, odds 1.75, price up" });

    expect(button).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(button);
    expect(onToggle).toHaveBeenCalledWith(legacy);
  });

  it("honours the legacy disabled flag", () => {
    render(<OddsButton selection={selection("sel-1", "Pick", 1.75)} selected={false} disabled onToggle={vi.fn()} />);

    expect(screen.getByRole("button")).toBeDisabled();
  });
});
