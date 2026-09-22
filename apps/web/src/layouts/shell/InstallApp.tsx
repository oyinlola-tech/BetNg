import { MonitorDown } from "lucide-react";
import { promptInstall, usePwa } from "../../pwa/pwa";

/** Offered only after the browser said the app can be installed; never prompts on its own. */
export function useInstallApp(): { readonly available: boolean; readonly install: () => void } {
  const { installable } = usePwa();

  return {
    available: installable,
    install: () => {
      void promptInstall();
    },
  };
}

export function InstallAppButton({ className, onDone }: { readonly className: string; readonly onDone?: () => void }): React.JSX.Element | null {
  const { available, install } = useInstallApp();

  if (!available) return null;

  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        onDone?.();
        install();
      }}
    >
      <MonitorDown className="size-5 text-text-muted" aria-hidden />
      <span className="flex-1 text-left">Install app</span>
    </button>
  );
}
