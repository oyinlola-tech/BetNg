import { useEffect, useState } from "react";
import { Button } from "./Button";
import { Modal } from "./Modal";
import { Textarea } from "./Textarea";

export interface ConfirmDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onConfirm: (reason: string) => void | Promise<void>;
  readonly title: string;
  readonly description: React.ReactNode;
  readonly confirmLabel: string;
  readonly cancelLabel?: string;
  readonly tone?: "primary" | "danger";
  /** Asks for a written reason, which the platform records in the audit log. */
  readonly requireReason?: boolean;
  readonly reasonMinLength?: number;
  readonly loading?: boolean;
  readonly children?: React.ReactNode;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "primary",
  requireReason = false,
  reasonMinLength = 4,
  loading = false,
  children,
}: ConfirmDialogProps): React.JSX.Element | null {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  const reasonOk = !requireReason || reason.trim().length >= reasonMinLength;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      dismissible={!loading}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            loading={loading}
            disabled={!reasonOk}
            onClick={() => {
              void onConfirm(reason.trim());
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {(children !== undefined || requireReason) && (
        <div className="space-y-3 text-base text-text-secondary">
          {children}
          {requireReason && (
            <Textarea
              label="Reason"
              hint="Recorded in the audit log."
              required
              value={reason}
              maxLength={240}
              onChange={(event) => {
                setReason(event.target.value);
              }}
            />
          )}
        </div>
      )}
    </Modal>
  );
}
