import { useState } from "react";
import { ConfirmationDialog } from "@betng/ui-web";

export interface PendingAction {
  readonly title: string;
  readonly description: React.ReactNode;
  readonly confirmLabel: string;
  readonly tone?: "primary" | "danger";
  /** False only where the platform route carries no reason; the dialog then confirms without asking for one. */
  readonly requireReason?: boolean;
  readonly details?: React.ReactNode;
  readonly run: (reason: string) => Promise<unknown>;
}

export function useReasonAction(): { readonly ask: (action: PendingAction) => void; readonly dialog: React.JSX.Element } {
  const [action, setAction] = useState<PendingAction | undefined>();
  const [loading, setLoading] = useState(false);

  const dialog = (
    <ConfirmationDialog
      open={action !== undefined}
      onClose={() => {
        if (!loading) setAction(undefined);
      }}
      title={action?.title ?? ""}
      description={action?.description ?? ""}
      confirmLabel={action?.confirmLabel ?? "Confirm"}
      tone={action?.tone ?? "primary"}
      requireReason={action?.requireReason ?? true}
      loading={loading}
      onConfirm={async (reason) => {
        if (action === undefined) return;
        setLoading(true);

        try {
          await action.run(reason);
          setAction(undefined);
        } catch {
          // The mutation reports its own failure; the dialog stays open so the operator can retry or cancel.
        } finally {
          setLoading(false);
        }
      }}
    >
      {action?.details}
    </ConfirmationDialog>
  );

  return { ask: setAction, dialog };
}
