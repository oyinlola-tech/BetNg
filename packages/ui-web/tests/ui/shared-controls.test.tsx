import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { DataSourceError } from "@betng/ui-core";
import {
  FileUpload,
  checkFile,
  type FileUploadState,
} from "../../src/forms/FileUpload";
import { Field } from "../../src/forms/Field";
import { Breadcrumbs } from "../../src/ui/Breadcrumbs";
import { Select } from "../../src/ui/Select";

const RULES = {
  accept: ["image/png", "application/pdf"],
  acceptLabel: "PNG or PDF",
  maxBytes: 1024,
};

function Harness({
  state,
  onCancel,
  onRetry,
}: {
  readonly state?: FileUploadState;
  readonly onCancel?: () => void;
  readonly onRetry?: () => void;
}): React.JSX.Element {
  const [file, setFile] = useState<File>();

  return (
    <FileUpload
      {...RULES}
      file={file}
      onFileChange={setFile}
      {...(state === undefined ? {} : { state })}
      {...(onCancel === undefined ? {} : { onCancel })}
      {...(onRetry === undefined ? {} : { onRetry })}
    />
  );
}

describe("FileUpload", () => {
  it("checks type, emptiness and size as a courtesy", () => {
    expect(
      checkFile(new File(["x"], "a.txt", { type: "text/plain" }), RULES),
    ).toBe("Upload a PNG or PDF file.");
    expect(checkFile(new File([], "a.png", { type: "image/png" }), RULES)).toBe(
      "That file is empty.",
    );
    expect(
      checkFile(
        new File(["x".repeat(2048)], "a.png", { type: "image/png" }),
        RULES,
      ),
    ).toBe("The file must be 1 KB or smaller.");
    expect(
      checkFile(new File(["x"], "a.png", { type: "image/png" }), RULES),
    ).toBeUndefined();
  });

  it("takes a file from the picker, and describes a rejected one on the input", async () => {
    const user = userEvent.setup({ applyAccept: false });

    render(<Harness />);

    const input = screen.getByLabelText("Choose a file");

    await user.upload(
      input,
      new File(["x"], "notes.txt", { type: "text/plain" }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Upload a PNG or PDF file.",
    );
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toContain(
      screen.getByRole("alert").id,
    );

    await user.upload(
      input,
      new File(["x"], "scan.png", { type: "image/png" }),
    );

    expect(screen.getByText("scan.png")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("accepts a dropped file", () => {
    render(<Harness />);

    const zone = screen.getByText("Drag a file here, or")
      .parentElement as HTMLElement;

    fireEvent.drop(zone, {
      dataTransfer: {
        files: [new File(["x"], "drop.pdf", { type: "application/pdf" })],
      },
    });

    expect(screen.getByText("drop.pdf")).toBeInTheDocument();
  });

  it("shows progress with a cancel control while uploading", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    render(
      <Harness
        state={{ phase: "uploading", loaded: 25, total: 100 }}
        onCancel={onCancel}
      />,
    );

    expect(
      screen.getByRole("progressbar", { name: "Upload progress" }),
    ).toHaveAttribute("aria-valuenow", "25");
    expect(screen.getByLabelText("Choose a file")).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Cancel upload" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("offers retry after a failure once a file is chosen, and shows the platform's error", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    render(
      <Harness
        state={{
          phase: "failed",
          error: new DataSourceError("NETWORK", "offline"),
        }}
        onRetry={onRetry}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Retry upload" }),
    ).not.toBeInTheDocument();

    await user.upload(
      screen.getByLabelText("Choose a file"),
      new File(["x"], "scan.png", { type: "image/png" }),
    );
    await user.click(screen.getByRole("button", { name: "Retry upload" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe("Breadcrumbs", () => {
  it("links every crumb but the current one, which is marked as the page", () => {
    render(
      <MemoryRouter>
        <Breadcrumbs
          items={[
            { label: "Fixtures", to: "/virtuals" },
            { label: "Premier", to: "/leagues/p" },
            { label: "Home v Away" },
          ]}
        />
      </MemoryRouter>,
    );

    const trail = screen.getByRole("navigation", { name: "Breadcrumb" });

    expect(
      within(trail)
        .getAllByRole("link")
        .map((link) => link.getAttribute("href")),
    ).toEqual(["/virtuals", "/leagues/p"]);
    expect(within(trail).getByText("Home v Away")).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(trail).getAllByRole("listitem")).toHaveLength(3);
  });
});

describe("Select", () => {
  it("takes its name from a Field label and reports the choice", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <Field label="Bank account" required error="Choose an account.">
        {(control) => (
          <Select
            {...control}
            value="a"
            onChange={onChange}
            options={[
              { value: "a", label: "First" },
              { value: "b", label: "Second" },
            ]}
          />
        )}
      </Field>,
    );

    const select = screen.getByRole("combobox", { name: /Bank account/ });

    expect(select).toHaveAttribute("aria-invalid", "true");
    expect(select).toHaveAttribute("aria-required", "true");

    await user.selectOptions(select, "b");

    expect(onChange).toHaveBeenCalledWith("b");
  });
});
