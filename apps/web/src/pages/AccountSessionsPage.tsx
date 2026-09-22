import { useState } from "react";
import { BellRing, Globe, LogOut, MonitorSmartphone, Smartphone, Trash2 } from "lucide-react";
import type { AccountSession, PushDevice } from "@betng/contracts";
import { formatDateTime, formatRelative } from "@betng/ui-core";
import { Badge, Button, Card, ConfirmationDialog, EmptyState, FormError, SectionHeading, SkeletonRows, useFlag, useSession, useToast } from "@betng/ui-web";
import { isNotImplemented, useAccountSessions, usePushDevices, useRevokeOtherSessions, useRevokeSession, useUnregisterPushDevice } from "../features/account/queries";
import { Unavailable } from "../features/account/Unavailable";
import { AccountErrorState, useLogoutFlow } from "../features/auth";
import { usePageMeta } from "../features/seo";
import { session } from "../services/runtime";

function sessionTitle(row: AccountSession): string {
  const parts = [row.device, row.browser].filter((part): part is string => part !== undefined && part !== "");

  return parts.length === 0 ? "Unknown device" : parts.join(" · ");
}

function CardHeader({ title, aside }: { readonly title: string; readonly aside?: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
      <SectionHeading as="h2">{title}</SectionHeading>
      {aside}
    </div>
  );
}

function ThisSession(): React.JSX.Element {
  const current = useSession(session).session;
  const logout = useLogoutFlow();

  return (
    <Card>
      <SectionHeading as="h2">This session</SectionHeading>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-sunken text-text-muted">
          <MonitorSmartphone className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 basis-48">
          <p className="type-body font-semibold text-text-primary">This browser</p>
          {current !== undefined && <p className="type-small text-text-muted">Signed in as {current.user.email}. Expires {formatDateTime(current.expiresAt)}.</p>}
        </div>
        <Button variant="secondary" className="w-full sm:w-auto" leadingIcon={<LogOut className="size-4" aria-hidden />} onClick={logout.request}>
          Sign out
        </Button>
      </div>
      {logout.dialog}
    </Card>
  );
}

function ActiveSessions(): React.JSX.Element {
  const enabled = useFlag("accountSessionsEnabled");
  const sessions = useAccountSessions(enabled);
  const revoke = useRevokeSession();
  const revokeOthers = useRevokeOtherSessions();
  const { toast } = useToast();
  const [target, setTarget] = useState<AccountSession>();
  const [confirmAll, setConfirmAll] = useState(false);

  if (!enabled || isNotImplemented(sessions.error)) {
    return (
      <Card padding="none">
        <CardHeader title="Signed-in devices" />
        <Unavailable title="Not available yet" description="The platform does not list your other signed-in devices yet. Signing out here ends this session only." />
      </Card>
    );
  }

  const others = sessions.data?.filter((row) => !row.current) ?? [];

  return (
    <Card padding="none">
      <CardHeader
        title="Signed-in devices"
        aside={
          others.length > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setConfirmAll(true);
              }}
            >
              Sign out all other devices
            </Button>
          ) : undefined
        }
      />
      <FormError error={revoke.error ?? revokeOthers.error} className="mx-4 mt-3" />
      {sessions.data === undefined ? (
        sessions.isError ? (
          <AccountErrorState error={sessions.error} compact onRetry={() => void sessions.refetch()} />
        ) : (
          <SkeletonRows rows={3} className="p-4" />
        )
      ) : (
        <ul className="divide-y divide-border">
          {sessions.data.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-sunken text-text-muted">
                {row.platform === "Android" || row.platform === "iOS" ? <Smartphone className="size-4.5" aria-hidden /> : <MonitorSmartphone className="size-4.5" aria-hidden />}
              </span>
              <div className="min-w-0 flex-1 basis-48">
                <p className="type-body flex flex-wrap items-center gap-2 font-semibold text-text-primary">
                  {sessionTitle(row)}
                  {row.current && <Badge tone="success">This device</Badge>}
                </p>
                <p className="type-small text-text-muted">
                  {[row.platform, row.location].filter((part) => part !== undefined && part !== "").join(" · ")}
                  {row.platform === undefined && row.location === undefined ? "" : " · "}
                  {row.current ? "Active now" : `Last active ${formatRelative(row.lastActiveAt)}`}
                </p>
              </div>
              {!row.current && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setTarget(row);
                  }}
                  aria-label={`Sign out ${sessionTitle(row)}`}
                >
                  Sign out
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <ConfirmationDialog
        open={target !== undefined}
        onClose={() => {
          setTarget(undefined);
        }}
        tone="danger"
        title="Sign out this device?"
        description={target === undefined ? "" : `${sessionTitle(target)} will need to sign in again. Anything unsaved on it is lost.`}
        confirmLabel="Sign out device"
        loading={revoke.isPending}
        onConfirm={async () => {
          if (target === undefined) return;
          await revoke.mutateAsync(target.id).then(
            () => {
              toast({ tone: "success", title: "Device signed out" });
            },
            () => undefined,
          );
          setTarget(undefined);
        }}
      />
      <ConfirmationDialog
        open={confirmAll}
        onClose={() => {
          setConfirmAll(false);
        }}
        tone="danger"
        title="Sign out all other devices?"
        description="Every device except this one will need to sign in again."
        confirmLabel="Sign out others"
        loading={revokeOthers.isPending}
        onConfirm={async () => {
          await revokeOthers.mutateAsync().then(
            () => {
              toast({ tone: "success", title: "Other devices signed out" });
            },
            () => undefined,
          );
          setConfirmAll(false);
        }}
      />
    </Card>
  );
}

function PushDevices(): React.JSX.Element {
  const enabled = useFlag("notificationChannelsEnabled");
  const devices = usePushDevices(enabled);
  const unregister = useUnregisterPushDevice();
  const [target, setTarget] = useState<PushDevice>();

  if (!enabled || isNotImplemented(devices.error)) {
    return (
      <Card padding="none">
        <CardHeader title="Push notifications" />
        <Unavailable title="Not available yet" description="Push notifications are not offered by the platform yet." />
      </Card>
    );
  }

  return (
    <Card padding="none">
      <CardHeader title="Push notifications" />
      {/* No VAPID public key is configured for the web client, so this browser cannot register for push. */}
      <p className="type-small flex items-start gap-2 border-b border-border px-4 py-3 text-text-secondary">
        <Globe className="mt-0.5 size-4 shrink-0 text-text-muted" aria-hidden />
        Browser notifications are not set up for this site. Devices registered from the BETNG app are listed below.
      </p>
      <FormError error={unregister.error} className="mx-4 mt-3" />
      {devices.data === undefined ? (
        devices.isError ? (
          <AccountErrorState error={devices.error} compact onRetry={() => void devices.refetch()} />
        ) : (
          <SkeletonRows rows={2} className="p-4" />
        )
      ) : devices.data.length === 0 ? (
        <EmptyState compact icon={<BellRing className="size-5" />} title="No devices" description="No device receives push notifications for this account." />
      ) : (
        <ul className="divide-y divide-border">
          {devices.data.map((device) => (
            <li key={device.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1 basis-48">
                <p className="type-body flex flex-wrap items-center gap-2 font-semibold text-text-primary">
                  {device.label}
                  {device.current && <Badge tone="success">This device</Badge>}
                </p>
                <p className="type-small text-text-muted">
                  {device.platform === "web" ? "Browser" : device.platform === "ios" ? "iOS" : "Android"} · Registered {formatDateTime(device.registeredAt)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                leadingIcon={<Trash2 className="size-3.5" aria-hidden />}
                aria-label={`Remove ${device.label}`}
                onClick={() => {
                  setTarget(device);
                }}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
      <ConfirmationDialog
        open={target !== undefined}
        onClose={() => {
          setTarget(undefined);
        }}
        tone="danger"
        title="Stop notifications on this device?"
        description={target === undefined ? "" : `${target.label} will no longer receive push notifications.`}
        confirmLabel="Remove device"
        loading={unregister.isPending}
        onConfirm={async () => {
          if (target === undefined) return;
          await unregister.mutateAsync(target.id).catch(() => undefined);
          setTarget(undefined);
        }}
      />
    </Card>
  );
}

export function AccountSessionsPage(): React.JSX.Element {
  usePageMeta({ title: "Sessions and devices", noindex: true });

  return (
    <div className="space-y-4">
      <ThisSession />
      <ActiveSessions />
      <PushDevices />
    </div>
  );
}
