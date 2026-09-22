import { useState } from "react";
import { Info } from "lucide-react";
import { formatDateTime } from "@betng/ui-core";
import { Button, CodeInput, Panel, PasswordInput, ThemeSwitcher, Tooltip } from "@betng/ui-web";
import { PageHeader } from "../components/PageHeader";
import { useShopSession } from "../hooks/useShopSession";

/**
 * Credential changes have no route yet (there is no `POST /shop/auth/password` or `/pin` in docs/frontend-api.md).
 * The forms are complete so wiring them is one call each; until then they cannot submit, and say so.
 */
const NOT_SERVED = "The platform does not serve credential changes from the terminal yet. Ask an administrator to reset your credentials from BetNG Admin.";

function Unavailable(): React.JSX.Element {
  return (
    <p className="flex items-start gap-2 rounded-sm border border-border bg-surface-sunken px-3 py-2.5 text-sm text-text-secondary">
      <Info className="mt-0.5 size-4 shrink-0 text-text-muted" aria-hidden />
      {NOT_SERVED}
    </p>
  );
}

export function SecurityPage(): React.JSX.Element {
  const { session } = useShopSession();
  const [pin, setPin] = useState("");
  const [nextPin, setNextPin] = useState("");

  return (
    <div className="mx-auto max-w-5xl p-4 lg:p-5">
      <PageHeader title="Security" description="Your password, your PIN and this session." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Change password">
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
            }}
          >
            <PasswordInput label="Current password" autoComplete="current-password" />
            <PasswordInput label="New password" autoComplete="new-password" hint="At least 8 characters." />
            <PasswordInput label="Repeat new password" autoComplete="new-password" />
            <Unavailable />
            <Tooltip content="Not served by the platform yet">
              <Button type="submit" disabled>
                Update password
              </Button>
            </Tooltip>
          </form>
        </Panel>
        <Panel title="Change PIN">
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
            }}
          >
            <CodeInput label="Current PIN" length={4} masked value={pin} onChange={setPin} />
            <CodeInput label="New PIN" length={4} masked value={nextPin} onChange={setNextPin} />
            <Unavailable />
            <Tooltip content="Not served by the platform yet">
              <Button type="submit" disabled>
                Update PIN
              </Button>
            </Tooltip>
          </form>
        </Panel>
        <Panel title="This session">
          <p className="text-base text-text-secondary">
            Signed in as <span className="font-medium text-text-primary">{session?.cashier.displayName}</span>. The session ends on its own at <span className="font-medium text-text-primary">{session === undefined ? "" : formatDateTime(session.expiresAt)}</span> and whenever this browser tab closes.
          </p>
        </Panel>
        <Panel title="Appearance">
          <p className="mb-3 text-base text-text-secondary">Dark suits a dim shop floor; light reads better under strong overhead lighting.</p>
          <ThemeSwitcher showLabels />
        </Panel>
      </div>
    </div>
  );
}
