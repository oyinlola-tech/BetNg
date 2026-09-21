import { Component } from "react";
import { ErrorFallback } from "./ErrorFallback";
import type { ErrorScope } from "./ErrorFallback";

export interface ErrorBoundaryFallbackArgs {
  readonly error: unknown;
  readonly reset: () => void;
}

export interface ErrorBoundaryProps {
  readonly fallback?:
    | React.ReactNode
    | ((args: ErrorBoundaryFallbackArgs) => React.ReactNode);
  readonly onError?: (error: unknown, info: React.ErrorInfo) => void;
  /** The boundary clears its error when any of these change, e.g. the route path. */
  readonly resetKeys?: readonly unknown[];
  readonly scope?: ErrorScope;
  readonly homeHref?: string;
  readonly children: React.ReactNode;
}

interface ErrorBoundaryState {
  readonly failed: boolean;
  readonly error: unknown;
}

const CLEAR: ErrorBoundaryState = { failed: false, error: undefined };

function changed(a: readonly unknown[] = [], b: readonly unknown[] = []): boolean {
  return a.length !== b.length || a.some((value, i) => !Object.is(value, b[i]));
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public override state: ErrorBoundaryState = CLEAR;

  public static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { failed: true, error };
  }

  public override componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    this.props.onError?.(error, info);
  }

  public override componentDidUpdate(previous: ErrorBoundaryProps): void {
    if (this.state.failed && changed(previous.resetKeys, this.props.resetKeys))
      this.reset();
  }

  private readonly reset = (): void => {
    this.setState(CLEAR);
  };

  public override render(): React.ReactNode {
    if (!this.state.failed) return this.props.children;

    const { fallback, scope = "route", homeHref } = this.props;

    if (typeof fallback === "function")
      return fallback({ error: this.state.error, reset: this.reset });

    if (fallback !== undefined) return fallback;

    return (
      <ErrorFallback
        error={this.state.error}
        scope={scope}
        onReset={this.reset}
        {...(homeHref === undefined ? {} : { homeHref })}
      />
    );
  }
}
