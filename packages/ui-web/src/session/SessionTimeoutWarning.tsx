import { useState } from "react";
import { Clock } from "lucide-react";
import type { SessionMonitor } from "@betng/ui-core";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { useSessionMonitor } from "./useSessionMonitor";

export interface SessionTimeoutWarningProps {
  readonly monitor: SessionMonitor;
  readonly onSignOut: () => void;
}

function remaining(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(seconds / 60);

  return minutes > 0 ? `${String(minutes)}:${String(seconds % 60).padStart(2, "0")}` : `${String(seconds)}s`;
}

/** Warns before the platform-issued session runs out. Only the platform can extend it; if it cannot, the user is told to sign in again. */
export function SessionTimeoutWarning({ monitor, onSignOut }: SessionTimeoutWarningProps): React.JSX.Element | null {
  const state = useSessionMonitor(monitor);
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (state.phase !== "EXPIRING") {
    if (dismissed) setDismissed(false);
    if (refused) setRefused(false);

    return null;
  }

  // Dismissing hides the warning until the final 30 seconds.
  if (dismissed && state.remainingMs > 30_000) return null;

  const stay = async (): Promise<void> => {
    setBusy(true);
    const ok = await monitor.refresh();

    setBusy(false);
    setRefused(!ok);
  };

  return (
    <Modal
      open
      size="sm"
      onClose={() => {
        setDismissed(true);
      }}
      title="Your session is about to end"
      description={
        <span className="flex items-center gap-2">
          <Clock className="size-4 shrink-0" aria-hidden />
          <span>
            Signing out in <span className="tabular-nums font-semibold" aria-live="off">{remaining(state.remainingMs)}</span> for your security.
          </span>
        </span>
      }
      footer={
        <div className="flex w-full flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onSignOut}>
            Sign out now
          </Button>
          {monitor.canRefresh && !refused && (
            <Button loading={busy} onClick={() => void stay()}>
              Stay signed in
            </Button>
          )}
        </div>
      }
    >
      {refused || !monitor.canRefresh ? (
        <p className="type-small text-text-secondary">The session cannot be extended from here. Save anything you need, then sign in again when it ends. Your place and bet slip are kept.</p>
      ) : (
        <p className="type-small text-text-secondary">Choose to stay signed in, or you will be asked to sign in again. Your place and bet slip are kept.</p>
      )}
    </Modal>
  );
}
