import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { IconButton } from "./IconButton";
import { cn } from "../../lib/cn";

export interface ModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly children: React.ReactNode;
  readonly footer?: React.ReactNode;
  readonly size?: "sm" | "md" | "lg";
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: ModalProps): React.JSX.Element | null {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;

    if (dialog === null) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className={cn(
        "m-auto w-[calc(100%-2rem)] rounded-lg border border-border bg-surface-elevated p-0 text-text-primary shadow-lg backdrop:bg-overlay animate-fade-in",
        size === "sm" && "max-w-sm",
        size === "md" && "max-w-md",
        size === "lg" && "max-w-2xl",
      )}
    >
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <h2 className="text-md font-semibold">{title}</h2>
        <IconButton label="Close" size="sm" onClick={onClose}>
          <X className="size-4" />
        </IconButton>
      </div>
      <div className="px-5 py-4">{children}</div>
      {footer !== undefined && (
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          {footer}
        </div>
      )}
    </dialog>
  );
}
