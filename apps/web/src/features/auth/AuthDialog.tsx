import { useEffect, useRef } from "react";
import { Modal, Sheet, useIsCompact, useSession } from "@betng/ui-web";
import { authSource } from "../../services/dataSource";
import { useAuthDialog } from "./auth.store";
import { AUTH_TITLES, AuthFlow } from "./AuthFlow";

/** The one sign-in surface. Mounted once in the shell; opened by `requireAuth`, the header, or a session expiring. */
export function AuthDialog(): React.JSX.Element {
  const { open, view, intent, pendingEmail, show, setView, setPendingEmail, close, complete } = useAuthDialog();
  const compact = useIsCompact();
  const { status } = useSession(authSource.session);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (status === "EXPIRED") show("expired", useAuthDialog.getState().intent);
  }, [status, show]);

  useEffect(() => {
    if (open) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

      return;
    }

    opener.current?.focus();
    opener.current = null;
  }, [open]);

  const flow = (
    <AuthFlow
      view={view}
      onView={setView}
      pendingEmail={pendingEmail}
      onPendingEmail={setPendingEmail}
      reason={intent?.reason}
      onAuthenticated={() => {
        complete()?.run?.();
      }}
    />
  );

  if (compact) {
    return (
      <Sheet open={open} onClose={close} title={AUTH_TITLES[view]} side="bottom">
        <div className="px-4 pb-8 pt-4">{flow}</div>
      </Sheet>
    );
  }

  return (
    <Modal open={open} onClose={close} title={AUTH_TITLES[view]} size="sm">
      {flow}
    </Modal>
  );
}
