import { useCallback, useEffect, useState } from "react";
import { BellOff, BellRing } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Card, FormError, SectionHeading, StatusBadge } from "@betng/ui-web";
import { serviceWorkerEnabled } from "../../pwa/pwa";
import { analytics } from "../../services/analytics";
import { accountServices, getRuntimeConfig } from "../../services/runtime";
import { accountKeys } from "../account/queries";
import { currentSubscription, disablePush, enablePush, pushSupport, rememberedDeviceId, type PushSupport } from "./webPush";

type Status = "checking" | "off" | "on" | "denied";

function permission(): NotificationPermission {
  return typeof Notification === "undefined" ? "default" : Notification.permission;
}

export interface BrowserPushCardProps {
  /** Overrides the runtime checks, for tests. */
  readonly support?: PushSupport;
  readonly vapidPublicKey?: string;
}

/** Browser notifications for this device. The permission prompt only ever follows a click here. */
export function BrowserPushCard({ support: forcedSupport, vapidPublicKey: forcedKey }: BrowserPushCardProps): React.JSX.Element | null {
  const client = useQueryClient();
  const vapidPublicKey = forcedKey ?? getRuntimeConfig()?.webPush?.vapidPublicKey;
  const support = forcedSupport ?? pushSupport({ serviceWorker: serviceWorkerEnabled(), vapidPublicKey });
  const [status, setStatus] = useState<Status>("checking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();

  const refresh = useCallback(async (): Promise<void> => {
    if (permission() === "denied") {
      setStatus("denied");

      return;
    }

    const subscription = await currentSubscription().catch(() => undefined);

    setStatus(subscription !== undefined && rememberedDeviceId() !== undefined ? "on" : "off");
  }, []);

  useEffect(() => {
    if (support === "available") void refresh();
  }, [support, refresh]);

  if (support === "not-configured") return null;

  const run = async (action: () => Promise<void>): Promise<void> => {
    setBusy(true);
    setError(undefined);

    try {
      await action();
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
      void client.invalidateQueries({ queryKey: accountKeys.pushDevices });
      await refresh();
    }
  };

  const turnOn = (): void => {
    if (vapidPublicKey === undefined) return;

    void run(async () => {
      const result = await enablePush(accountServices.devices, vapidPublicKey);

      if (result === "enabled") analytics.track("push_enabled");
    });
  };

  const turnOff = (): void => {
    void run(() => disablePush(accountServices.devices));
  };

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <SectionHeading as="h2">Browser notifications</SectionHeading>
          <p className="type-small mt-2 max-w-md text-text-muted">
            Alerts from the platform on this browser, such as settled bets and confirmed payments, even when BETNG is not open.
          </p>
        </div>
        {support === "available" && status === "on" && <StatusBadge tone="success">On for this browser</StatusBadge>}
        {support === "available" && status === "denied" && <StatusBadge tone="warning">Blocked</StatusBadge>}
      </div>
      <FormError error={error} className="mt-3" />
      <div className="mt-3">
        {support === "unsupported" ? (
          <p className="type-small flex items-start gap-2 text-text-secondary">
            <BellOff className="mt-0.5 size-4 shrink-0 text-text-muted" aria-hidden />
            This browser cannot receive notifications from BETNG. In-app alerts still arrive while the site is open.
          </p>
        ) : status === "denied" ? (
          <p className="type-small flex items-start gap-2 text-text-secondary" role="status">
            <BellOff className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            Notifications are blocked for this site. To turn them on, allow notifications for BETNG in your browser’s site settings, then come back here.
          </p>
        ) : status === "on" ? (
          <Button variant="secondary" size="sm" loading={busy} onClick={turnOff} leadingIcon={<BellOff className="size-3.5" aria-hidden />}>
            Turn off for this browser
          </Button>
        ) : (
          <Button size="sm" loading={busy} disabled={status === "checking"} onClick={turnOn} leadingIcon={<BellRing className="size-3.5" aria-hidden />}>
            Turn on browser notifications
          </Button>
        )}
      </div>
    </Card>
  );
}
