import { useEffect, useState } from "react";

export interface Toast {
  readonly message: string;
  readonly key: number;
}

export function RemoteToast({ toast }: { readonly toast: Toast | undefined }): React.JSX.Element | null {
  const [shown, setShown] = useState<Toast | undefined>(toast);

  useEffect(() => {
    setShown(toast);
    if (toast === undefined) return;

    const timer = setTimeout(() => {
      setShown(undefined);
    }, 2500);

    return () => {
      clearTimeout(timer);
    };
  }, [toast]);

  if (shown === undefined) return null;

  return (
    <div role="status" aria-live="polite" className="fixed left-1/2 top-[5rem] z-50 -translate-x-1/2 rounded-md border border-border-strong bg-surface-elevated px-[1.6rem] py-[0.7rem] font-display text-[1.3rem] font-black shadow-lg animate-fade-in">
      {shown.message}
    </div>
  );
}
