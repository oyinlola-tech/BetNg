import { useId } from "react";
import { X } from "lucide-react";
import { IconButton } from "./IconButton";
import { cn } from "../lib/cn";
import { useModalDialog } from "./useModalDialog";

export type SheetSide = "right" | "bottom";

export interface SheetProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly description?: string;
  readonly side?: SheetSide;
  readonly children: React.ReactNode;
  readonly footer?: React.ReactNode;
  readonly dismissible?: boolean;
}

const SIDES: Record<SheetSide, string> = {
  right:
    "inset-y-0 left-auto right-0 h-dvh max-h-none max-w-md border-l animate-slide-in-right",
  bottom:
    "inset-x-0 bottom-0 top-auto max-h-[85dvh] max-w-none rounded-t-lg border-t pb-[env(safe-area-inset-bottom)] animate-slide-up",
};

export function Sheet({
  open,
  onClose,
  title,
  description,
  side = "right",
  children,
  footer,
  dismissible = true,
}: SheetProps): React.JSX.Element | null {
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
        "fixed m-0 flex w-full flex-col border-border bg-surface-elevated p-0 text-text-primary shadow-lg backdrop:bg-overlay",
        SIDES[side],
      )}
    >
      {side === "bottom" && (
        <span
          aria-hidden
          className="mx-auto mt-1.5 h-1 w-10 shrink-0 rounded-full bg-border-strong"
        />
      )}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
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
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        {children}
      </div>
      {footer !== undefined && (
        <footer className="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-3">
          {footer}
        </footer>
      )}
    </dialog>
  );
}
