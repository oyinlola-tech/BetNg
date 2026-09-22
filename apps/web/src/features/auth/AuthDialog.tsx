import { useEffect, useRef } from "react";
import { BottomSheet, Dialog, useIsCompact, useSession } from "@betng/ui-web";
import { session } from "../../services/runtime";
import { applyDisplayPreferences } from "../account/displayPreferences";
import { useAuthDialog } from "./auth.store";
import { AUTH_TITLES, AuthFlow } from "./AuthFlow";

export function AuthDialog(): React.JSX.Element {
  const { open, view, intent, pendingEmail, challenge, show, setView, setPendingEmail, setChallenge, close, complete } = useAuthDialog();
  const compact = useIsCompact();
  const { status } = useSession(session);
  const opener = useRef<HTMLElement | null>(null);

  /* Mounted once by the shell after start-up, so device display preferences are applied over the platform defaults here. */
  useEffect(applyDisplayPreferences, []);

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
      challenge={challenge}
      onChallenge={setChallenge}
      reason={intent?.reason}
      onAuthenticated={() => {
        complete()?.run?.();
      }}
    />
  );

  if (compact) {
    return (
      <BottomSheet open={open} onClose={close} title={AUTH_TITLES[view]}>
        <div className="px-4 pb-8 pt-4">{flow}</div>
      </BottomSheet>
    );
  }

  return (
    <Dialog open={open} onClose={close} title={AUTH_TITLES[view]} size="sm">
      {flow}
    </Dialog>
  );
}
