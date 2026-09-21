import { useEffect, useRef } from "react";
import { Clock } from "lucide-react";
import type { ShopSession } from "@betng/contracts";
import { Button } from "@betng/ui-web";
import { shopSource } from "../services/dataSource";
import { LoginForm } from "./LoginForm";

/** Re-authenticates in place: the route, the slip and any half-typed form stay exactly where they were. */
export function SessionExpiredOverlay({ session }: { readonly session: ShopSession | undefined }): React.JSX.Element {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;

    if (dialog === null || dialog.open) return;

    dialog.showModal();
    dialog.querySelector<HTMLInputElement>('input[autocomplete="current-password"]')?.focus();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby="session-expired-title"
      onCancel={(event) => {
        event.preventDefault();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-border bg-surface-elevated p-0 text-text-primary shadow-lg backdrop:bg-overlay backdrop:backdrop-blur-sm"
    >
      <div className="p-6">
        <div className="mb-4 flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-warning-subtle text-warning">
            <Clock className="size-4.5" aria-hidden />
          </span>
          <div>
            <h2 id="session-expired-title" className="text-md font-semibold">
              Your session has ended
            </h2>
            <p className="mt-0.5 text-sm text-text-muted">Sign in again to carry on. The slip and this screen are kept; nothing unfinished was submitted.</p>
          </div>
        </div>
        <LoginForm submitLabel="Sign in and continue" {...(session === undefined ? {} : { fixed: { shopCode: session.shop.code, username: session.cashier.username } })} />
        <Button
          variant="ghost"
          full
          className="mt-2"
          onClick={() => {
            void shopSource.logout();
          }}
        >
          Sign in as a different cashier
        </Button>
      </div>
    </dialog>
  );
}
