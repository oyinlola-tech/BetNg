import { useId } from "react";
import { X } from "lucide-react";
import { IconButton } from "./IconButton";
import { cn } from "../lib/cn";
import { useModalDialog } from "./useModalDialog";

export type ModalSize = "sm" | "md" | "lg";

export interface ModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly description?: React.ReactNode;
  readonly children?: React.ReactNode;
  readonly footer?: React.ReactNode;
  readonly size?: ModalSize;
  /** When false, Escape and backdrop clicks do nothing and the close button is removed. */
  readonly dismissible?: boolean;
}

const SIZES: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  dismissible = true,
}: ModalProps): React.JSX.Element | null {
  const id = useId();
  const { ref, ...handlers } = useModalDialog(open, onClose, dismissible);

  if (!open) return null;

  return (
    <dialog
      ref={ref}
      aria-labelledby={`${id}-title`}
      aria-describedby={description === undefined ? undefined : `${id}-description`}
      {...handlers}
      className={cn(
        "m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] flex-col overflow-hidden rounded-lg border border-border bg-surface-elevated p-0 text-text-primary shadow-lg backdrop:bg-overlay animate-fade-in open:flex",
        SIZES[size],
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-3">
        <h2 id={`${id}-title`} className="text-md font-semibold">
          {title}
        </h2>
        {dismissible && (
          <IconButton label="Close" size="sm" onClick={onClose}>
            <X className="size-4" aria-hidden />
          </IconButton>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 scrollbar-thin">
        {description !== undefined && (
          <div
            id={`${id}-description`}
            className={cn(
              "text-base text-text-secondary",
              children !== undefined && "mb-3",
            )}
          >
            {description}
          </div>
        )}
        {children}
      </div>
      {footer !== undefined && (
        <div className="flex shrink-0 justify-end gap-2 border-t border-border px-5 py-3">
          {footer}
        </div>
      )}
    </dialog>
  );
}
