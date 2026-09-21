import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "../lib/cn";

export type ToastTone = "info" | "success" | "danger";

interface Toast {
  readonly id: number;
  readonly title: string;
  readonly message?: string;
  readonly tone: ToastTone;
}

interface ToastContextValue {
  readonly toast: (input: Omit<Toast, "id">) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const ICONS: Record<ToastTone, React.ComponentType<{ className?: string }>> = {
  info: Info,
  success: CheckCircle2,
  danger: TriangleAlert,
};

export function ToastProvider({
  children,
}: {
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const [toasts, setToasts] = useState<readonly Toast[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (input: Omit<Toast, "id">) => {
      const id = ++counter.current;

      setToasts((current) => [...current.slice(-3), { ...input, id }]);
      setTimeout(() => {
        dismiss(id);
      }, 4200);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);
  const region = useRef<HTMLDivElement>(null);

  // A modal dialog sits in the browser's top layer, above any z-index. Re-showing the region as a popover on each toast puts it back on top of whatever opened since.
  useEffect(() => {
    const node = region.current;

    if (node === null || typeof node.showPopover !== "function") return;

    if (node.matches(":popover-open")) node.hidePopover();
    if (toasts.length > 0) node.showPopover();
  }, [toasts]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        ref={region}
        popover="manual"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-auto bottom-4 z-toast m-0 flex h-auto w-auto flex-col items-center gap-2 overflow-visible border-0 bg-transparent p-0 px-4 sm:items-end sm:px-6"
      >
        {toasts.map((t) => {
          const Icon = ICONS[t.tone];

          return (
            <div
              key={t.id}
              role="status"
              className={cn(
                "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-md border bg-surface-elevated p-3 shadow-lg animate-toast-in",
                t.tone === "success" && "border-success/40",
                t.tone === "danger" && "border-danger/40",
                t.tone === "info" && "border-border",
              )}
            >
              <Icon
                className={cn(
                  "mt-0.5 size-4 shrink-0",
                  t.tone === "success" && "text-success",
                  t.tone === "danger" && "text-danger",
                  t.tone === "info" && "text-brand",
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-text-primary">
                  {t.title}
                </p>
                {t.message !== undefined && (
                  <p className="mt-0.5 text-sm text-text-secondary">
                    {t.message}
                  </p>
                )}
              </div>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => {
                  dismiss(t.id);
                }}
                className="rounded-sm p-1 text-text-muted hover:text-text-primary focus-ring"
              >
                <X className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);

  if (ctx === undefined)
    throw new Error("useToast must be used within ToastProvider");

  return ctx;
}
