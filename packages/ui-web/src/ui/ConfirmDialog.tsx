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
  readonly tone?: "primary" | "danger";
  /** Asks for a written reason, which the platform records in the audit log. */
  readonly requireReason?: boolean;
  readonly loading?: boolean;
  readonly children?: React.ReactNode;
}

export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel, tone = "primary", requireReason = false, loading = false, children }: ConfirmDialogProps): React.JSX.Element | null {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  const reasonOk = !requireReason || reason.trim().length >= 4;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
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
      <div className="space-y-3 text-base text-text-secondary">
        <div>{description}</div>
        {children}
        {requireReason && (
          <Textarea
            label="Reason"
            hint="Recorded in the audit log."
            value={reason}
            maxLength={240}
            onChange={(event) => {
              setReason(event.target.value);
            }}
          />
        )}
      </div>
    </Modal>
  );
}
