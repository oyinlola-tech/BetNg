import { useId } from "react";
import { X } from "lucide-react";
import { IconButton } from "./IconButton";
import { cn } from "../lib/cn";
import { useModalDialog } from "./useModalDialog";

export interface DrawerProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly description?: string;
  readonly side?: "right" | "left";
  readonly size?: "md" | "lg";
  readonly children: React.ReactNode;
  readonly footer?: React.ReactNode;
  readonly dismissible?: boolean;
}

export function Drawer({
  open,
  onClose,
  title,
  description,
  side = "right",
  size = "md",
  children,
  footer,
  dismissible = true,
}: DrawerProps): React.JSX.Element | null {
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
        "fixed inset-y-0 m-0 flex h-dvh max-h-none w-full flex-col border-border bg-surface-elevated p-0 text-text-primary shadow-lg backdrop:bg-overlay",
        side === "right"
          ? "left-auto right-0 border-l animate-slide-in-right"
          : "left-0 right-auto border-r",
        size === "md" ? "max-w-md" : "max-w-2xl",
      )}
    >
      <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-3.5">
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="truncate text-md font-semibold">
            {title}
          </h2>
          {description !== undefined && (
            <p id={`${id}-description`} className="mt-0.5 text-sm text-text-muted">
              {description}
            </p>
          )}
        </div>
        {dismissible && (
          <IconButton label="Close" size="sm" onClick={onClose}>
            <X className="size-4" aria-hidden />
          </IconButton>
        )}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 scrollbar-thin">
        {children}
      </div>
      {footer !== undefined && (
        <footer className="flex justify-end gap-2 border-t border-border px-5 py-3">
          {footer}
        </footer>
      )}
    </dialog>
  );
}
