import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Toast } from "../feedback/Toast";
import type { ToastAction, ToastKind } from "../feedback/Toast";

/** `danger` is the earlier name for `error` and is still accepted. */
export type ToastTone =
  | "success"
  | "info"
  | "warning"
  | "error"
  | "system"
  | "danger";

export interface ToastInput {
  readonly title: string;
  readonly message?: string;
  readonly tone?: ToastTone;
  readonly kind?: ToastKind;
  readonly action?: ToastAction;
  readonly duration?: number;
}

export interface ToastContextValue {
  readonly toast: (input: ToastInput) => number;
  readonly dismiss: (id: number) => void;
  readonly dismissAll: () => void;
}

interface ToastEntry extends ToastInput {
  readonly id: number;
}

const MAX_VISIBLE = 4;

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({
  children,
}: {
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const [toasts, setToasts] = useState<readonly ToastEntry[]>([]);
  const counter = useRef(0);
  const region = useRef<HTMLDivElement>(null);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setToasts([]);
  }, []);

  const toast = useCallback((input: ToastInput) => {
    const id = ++counter.current;

    setToasts((current) => [
      ...current.slice(-(MAX_VISIBLE - 1)),
      { ...input, id },
    ]);

    return id;
  }, []);

  const value = useMemo(
    () => ({ toast, dismiss, dismissAll }),
    [toast, dismiss, dismissAll],
  );

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
        role="region"
        aria-label="Notifications"
        className="pointer-events-none fixed inset-x-0 top-auto bottom-4 z-toast m-0 flex h-auto w-auto flex-col items-center gap-2 overflow-visible border-0 bg-transparent p-0 px-4 sm:items-end sm:px-6"
      >
        {toasts.map(({ id, tone, ...rest }) => (
          <Toast
            key={id}
            {...rest}
            tone={tone === "danger" ? "error" : (tone ?? "info")}
            onDismiss={() => {
              dismiss(id);
            }}
          />
        ))}
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
