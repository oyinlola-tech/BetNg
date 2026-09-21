import { LogOut, MonitorSmartphone } from "lucide-react";
import { formatDateTime } from "@betng/ui-core";
import { Button, Card, SectionHeading, StatusBadge, useSession } from "@betng/ui-web";
import { Unavailable } from "../features/account/Unavailable";
import { useLogoutFlow } from "../features/auth";
import { usePageMeta } from "../features/seo";
import { session } from "../services/runtime";

export function AccountSessionsPage(): React.JSX.Element {
  usePageMeta({ title: "Sessions", noindex: true });

  const current = useSession(session).session;
  const logout = useLogoutFlow();

  return (
    <div className="space-y-4">
      <Card>
        <SectionHeading as="h2">This session</SectionHeading>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-sunken text-text-muted">
            <MonitorSmartphone className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1 basis-48">
            <p className="type-body flex flex-wrap items-center gap-x-2 font-semibold text-text-primary">
              This browser tab <StatusBadge status="ACTIVE" />
            </p>
            {current !== undefined && <p className="type-small text-text-muted">Signed in as {current.user.email}. Expires {formatDateTime(current.expiresAt)}.</p>}
          </div>
          <Button variant="secondary" className="w-full sm:w-auto" leadingIcon={<LogOut className="size-4" aria-hidden />} onClick={logout.request}>
            Sign out
          </Button>
        </div>
      </Card>
      <Card padding="none">
        <div className="border-b border-border px-4 py-3">
          <SectionHeading as="h2">Other sessions</SectionHeading>
        </div>
        <Unavailable title="Not available yet" description="The platform does not list your other signed-in devices yet. Signing out here ends this session only." />
      </Card>
      {logout.dialog}
    </div>
  );
}
