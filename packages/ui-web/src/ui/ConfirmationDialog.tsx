import { ConfirmDialog } from "./ConfirmDialog";
import type { ConfirmDialogProps } from "./ConfirmDialog";

export type ConfirmationDialogProps = ConfirmDialogProps;

export const ConfirmationDialog: (
  props: ConfirmationDialogProps,
) => React.JSX.Element | null = ConfirmDialog;
