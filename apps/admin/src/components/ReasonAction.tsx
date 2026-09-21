import { useState } from "react";
import { ConfirmDialog } from "@betng/ui-web";

export interface PendingAction {
  readonly title: string;
  readonly description: React.ReactNode;
  readonly confirmLabel: string;
  readonly tone?: "primary" | "danger";
  readonly run: (reason: string) => Promise<unknown>;
}

export function useReasonAction(): { readonly ask: (action: PendingAction) => void; readonly dialog: React.JSX.Element } {
  const [action, setAction] = useState<PendingAction | undefined>();
  const [loading, setLoading] = useState(false);

  const dialog = (
    <ConfirmDialog
      open={action !== undefined}
      onClose={() => {
        if (!loading) setAction(undefined);
      }}
      title={action?.title ?? ""}
      description={action?.description ?? ""}
      confirmLabel={action?.confirmLabel ?? "Confirm"}
      tone={action?.tone ?? "primary"}
      requireReason
      loading={loading}
      onConfirm={async (reason) => {
        if (action === undefined) return;
        setLoading(true);

        try {
          await action.run(reason);
          setAction(undefined);
        } catch {
        } finally {
          setLoading(false);
        }
      }}
    />
  );

  return { ask: setAction, dialog };
}
