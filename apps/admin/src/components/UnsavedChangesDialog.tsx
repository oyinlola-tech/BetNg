import { ConfirmationDialog, useUnsavedChangesGuard } from "@betng/ui-web";

/** Holds an in-app navigation while a form has edits, and asks before they are lost. */
export function UnsavedChangesDialog({ dirty }: { readonly dirty: boolean }): React.JSX.Element {
  const guard = useUnsavedChangesGuard(dirty);

  return <ConfirmationDialog open={guard.blocked} onClose={guard.stay} onConfirm={guard.proceed} title="Leave without saving?" description="Your changes on this screen have not been saved and will be lost." confirmLabel="Discard changes" cancelLabel="Keep editing" tone="danger" />;
}
