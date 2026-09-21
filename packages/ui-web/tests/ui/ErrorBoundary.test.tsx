import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "../../src/feedback/ErrorBoundary";
import { RouteErrorBoundary } from "../../src/feedback/RouteErrorBoundary";

function Widget({ broken }: { readonly broken: boolean }): React.JSX.Element {
  if (broken) throw new Error("odds feed exploded at line 42");

  return <p>Widget ready</p>;
}

// React reports caught render errors itself; keep that out of the test output.
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ErrorBoundary", () => {
  it("renders children when nothing throws", () => {
    render(
      <ErrorBoundary>
        <Widget broken={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Widget ready")).toBeInTheDocument();
  });

  it("catches, reports through onError and hides the raw message", () => {
    const onError = vi.fn();

    render(
      <ErrorBoundary scope="feature" onError={onError}>
        <Widget broken />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("This section is unavailable");
    expect(screen.queryByText(/exploded/)).not.toBeInTheDocument();
    expect(onError).toHaveBeenCalledTimes(1);

    const [error, info] = onError.mock.calls[0] as [Error, React.ErrorInfo];

    expect(error.message).toBe("odds feed exploded at line 42");
    expect(typeof info.componentStack).toBe("string");
  });

  it("resets when resetKeys change", () => {
    const { rerender } = render(
      <ErrorBoundary resetKeys={["/live"]}>
        <Widget broken />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();

    rerender(
      <ErrorBoundary resetKeys={["/results"]}>
        <Widget broken={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Widget ready")).toBeInTheDocument();
  });

  it("offers Try again and Go home at route scope", async () => {
    let broken = true;

    function Flaky(): React.JSX.Element {
      return <Widget broken={broken} />;
    }

    render(
      <ErrorBoundary scope="route" homeHref="/home">
        <Flaky />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("link", { name: "Go home" })).toHaveAttribute("href", "/home");

    broken = false;
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(screen.getByText("Widget ready")).toBeInTheDocument();
  });

  it("offers a reload at global scope", () => {
    render(
      <ErrorBoundary scope="global">
        <Widget broken />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
  });

  it("renders a custom fallback with reset", () => {
    render(
      <ErrorBoundary fallback={({ reset }) => <button onClick={reset}>Custom retry</button>}>
        <Widget broken />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("button", { name: "Custom retry" })).toBeInTheDocument();
  });
});

function renderRoute(status: number | undefined): void {
  const router = createMemoryRouter([
    {
      path: "/",
      loader: () => {
        if (status === undefined) throw new Error("loader crashed");

        // A route loader signals an HTTP status by throwing a Response.
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw new Response("", { status });
      },
      element: <p>Loaded</p>,
      errorElement: <RouteErrorBoundary />,
    },
  ]);

  render(<RouterProvider router={router} />);
}

describe("RouteErrorBoundary", () => {
  it.each([
    [404, "Page not found"],
    [401, "Sign in required"],
    [403, "Permission denied"],
    [503, "Down for maintenance"],
  ])("maps a %i response to its state", async (status, title) => {
    renderRoute(status);

    expect(await screen.findByText(title)).toBeInTheDocument();
  });

  it("shows the route fallback for other errors", async () => {
    renderRoute(undefined);

    expect(await screen.findByText("This page could not be shown")).toBeInTheDocument();
    expect(screen.queryByText(/loader crashed/)).not.toBeInTheDocument();
  });
});
