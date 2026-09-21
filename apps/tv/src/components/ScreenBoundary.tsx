import { Component, type ErrorInfo, type ReactNode } from "react";
import { logger } from "../services/logger";
import { ErrorPanel } from "./ErrorPanel";

const RECOVER_AFTER_MS = 15_000;

interface Props {
  readonly resetKey: string;
  readonly children: ReactNode;
}

/** An unattended display must heal itself: a render failure shows a notice, then the screen is retried. */
export class ScreenBoundary extends Component<Props, { readonly failed: boolean }> {
  private timer: ReturnType<typeof setTimeout> | undefined;

  public constructor(props: Props) {
    super(props);
    this.state = { failed: false };
  }

  public static getDerivedStateFromError(): { readonly failed: boolean } {
    return { failed: true };
  }

  public override componentDidCatch(error: Error, info: ErrorInfo): void {
    logger.error("ui", "A TV screen failed to render", { message: error.message, stack: info.componentStack ?? "" });
    this.timer = setTimeout(() => {
      this.setState({ failed: false });
    }, RECOVER_AFTER_MS);
  }

  public override componentDidUpdate(previous: Props): void {
    if (previous.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false });
  }

  public override componentWillUnmount(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
  }

  public override render(): ReactNode {
    return this.state.failed ? <ErrorPanel title="Something went wrong on this screen" detail="Retrying in a few seconds." /> : this.props.children;
  }
}
