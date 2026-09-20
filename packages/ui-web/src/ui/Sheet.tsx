import { useEffect } from "react";
import { X } from "lucide-react";
import { IconButton } from "./IconButton";
import { cn } from "../../lib/cn";

export interface SheetProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly side?: "right" | "bottom";
  readonly children: React.ReactNode;
}

export function Sheet({
  open,
  onClose,
  title,
  side = "right",
  children,
}: SheetProps): React.JSX.Element | null {
  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-sheet">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-overlay animate-fade-in"
      />
      <section
        role="dialog"
        aria-modal
        aria-label={title}
        className={cn(
          "absolute flex flex-col bg-surface-elevated shadow-lg",
          side === "right" &&
            "inset-y-0 right-0 w-full max-w-md animate-slide-in-right",
          side === "bottom" &&
            "inset-x-0 bottom-0 max-h-[90dvh] rounded-t-lg animate-slide-up",
        )}
      >
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          {side === "bottom" && (
            <span
              aria-hidden
              className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-border-strong"
            />
          )}
          <h2 className="text-md font-semibold">{title}</h2>
          <IconButton label="Close" size="sm" onClick={onClose}>
            <X className="size-4" />
          </IconButton>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
          {children}
        </div>
      </section>
    </div>
  );
}
