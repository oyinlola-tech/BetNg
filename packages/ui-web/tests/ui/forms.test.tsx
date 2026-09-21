import { render, screen } from "@testing-library/react";
import { DataSourceError } from "@betng/ui-core";
import { describe, expect, it, vi } from "vitest";
import { applyFieldErrors } from "../../src/forms/applyFieldErrors";
import { Field } from "../../src/forms/Field";
import { FormActions } from "../../src/forms/FormActions";
import { FormError } from "../../src/forms/FormError";

describe("Field", () => {
  it("wires label, hint and required onto a child element", () => {
    render(
      <Field label="Email" hint="Used for receipts." required>
        <input type="email" />
      </Field>,
    );

    const input = screen.getByLabelText(/Email/);

    expect(input).toHaveAttribute("aria-required", "true");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).toHaveAccessibleDescription("Used for receipts.");
  });

  it("marks the control invalid and describes it with the error first", () => {
    render(
      <Field label="Stake" hint="Minimum NGN 100." error="Enter a stake.">
        <input />
      </Field>,
    );

    const input = screen.getByLabelText("Stake");
    const [errorId, hintId] = (input.getAttribute("aria-describedby") ?? "").split(" ");

    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(document.getElementById(errorId ?? "")).toHaveTextContent("Enter a stake.");
    expect(document.getElementById(hintId ?? "")).toHaveTextContent("Minimum NGN 100.");
  });

  it("supports a render prop", () => {
    render(
      <Field label="Phone" error="Not a valid number.">
        {(control) => <input data-testid="phone" {...control} />}
      </Field>,
    );

    const input = screen.getByTestId("phone");

    expect(screen.getByLabelText("Phone")).toBe(input);
    expect(input).toHaveAccessibleDescription("Not a valid number.");
  });
});

describe("applyFieldErrors", () => {
  const error = new DataSourceError("VALIDATION", "Check the details", {
    fields: { email: "Already registered.", phone: "Not a valid number." },
  });

  it("maps server fields onto the setter", () => {
    const setError = vi.fn<(name: string, error: { type: string; message: string }) => void>();
    const result = applyFieldErrors(error, setError);

    expect(setError).toHaveBeenCalledWith("email", { type: "server", message: "Already registered." });
    expect(setError).toHaveBeenCalledWith("phone", { type: "server", message: "Not a valid number." });
    expect(result.applied).toEqual(["email", "phone"]);
    expect(result.unmatched).toEqual({});
  });

  it("returns fields the form does not own as unmatched", () => {
    const setError = vi.fn<(name: "email", error: { type: string; message: string }) => void>();
    const result = applyFieldErrors(error, setError, ["email"]);

    expect(setError).toHaveBeenCalledTimes(1);
    expect(result.applied).toEqual(["email"]);
    expect(result.unmatched).toEqual({ phone: "Not a valid number." });
  });

  it("skips prototype-polluting field names", () => {
    const setError = vi.fn<(name: string, error: { type: string; message: string }) => void>();
    const hostile = new DataSourceError("VALIDATION", "", {
      fields: JSON.parse('{"__proto__.polluted":"x","a.constructor.b":"y","name":"Required."}') as Record<string, string>,
    });

    expect(applyFieldErrors(hostile, setError).applied).toEqual(["name"]);
  });

  it("does nothing for errors without field detail", () => {
    const setError = vi.fn<(name: string, error: { type: string; message: string }) => void>();

    expect(applyFieldErrors(new Error("boom"), setError).applied).toEqual([]);
    expect(applyFieldErrors(new DataSourceError("SERVER", ""), setError).applied).toEqual([]);
    expect(setError).not.toHaveBeenCalled();
  });
});

describe("FormError", () => {
  it("renders nothing without an error", () => {
    const { container } = render(<FormError error={undefined} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("presents a backend error with its request id", () => {
    render(<FormError error={new DataSourceError("SERVER", "stack: pg", { requestId: "req_77" })} />);

    const alert = screen.getByRole("alert");

    expect(alert).toHaveTextContent("Something went wrong");
    expect(alert).toHaveTextContent("req_77");
    expect(alert).not.toHaveTextContent("pg");
  });
});

describe("FormActions", () => {
  it("disables submit and reset until the form is dirty", () => {
    const { rerender } = render(<FormActions dirty={false} onReset={() => undefined} />);

    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reset" })).toBeDisabled();

    rerender(<FormActions dirty onReset={() => undefined} />);

    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Save changes" })).toHaveAttribute("type", "submit");
    expect(screen.getByRole("status")).toHaveTextContent("Unsaved changes");
  });

  it("shows the loading state on submit", () => {
    render(<FormActions dirty loading />);

    expect(screen.getByRole("button", { name: "Save changes" })).toHaveAttribute("aria-busy", "true");
  });
});
