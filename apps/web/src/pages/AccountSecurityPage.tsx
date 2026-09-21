import { useState } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { Button, Card, FormError, SectionHeading, useToast } from "@betng/ui-web";
import { Unavailable } from "../features/account/Unavailable";
import { useAuth } from "../features/auth";
import { usePageMeta } from "../features/seo";
import { authSource, logger } from "../services/runtime";

export function AccountSecurityPage(): React.JSX.Element {
  usePageMeta({ title: "Security", noindex: true });

  const { user } = useAuth();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>();

  const sendReset = async (): Promise<void> => {
    if (user === undefined) return;

    setBusy(true);
    setFailure(undefined);

    try {
      await authSource.requestPasswordReset(user.email);
      toast({ tone: "success", title: "Reset link requested", message: "If the address is registered, a link to set a new password is on its way." });
    } catch (cause) {
      logger.warn("auth", "Password reset request failed");
      setFailure(cause);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <SectionHeading as="h2">Password</SectionHeading>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <p className="type-small flex max-w-prose items-start gap-2 text-text-secondary">
            <KeyRound className="mt-0.5 size-4 shrink-0 text-text-muted" aria-hidden />
            Changing the password from this page is not available from the platform yet. You can ask for a reset link by email instead.
          </p>
          <Button variant="secondary" loading={busy} onClick={() => void sendReset()}>
            Email me a reset link
          </Button>
        </div>
        <FormError error={failure} className="mt-3" />
      </Card>
      <Card padding="none">
        <div className="border-b border-border px-4 py-3">
          <SectionHeading as="h2">Two-step verification</SectionHeading>
        </div>
        <Unavailable title="Not available yet" description="Two-step verification is not offered by the platform yet. It will appear here when it is." />
      </Card>
      <p className="type-small flex items-start gap-2 text-text-muted">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        BETNG never stores your password in this browser. Your session ends when you close the tab or sign out.
      </p>
    </div>
  );
}
