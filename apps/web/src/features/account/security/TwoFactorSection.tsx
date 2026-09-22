import { useState } from "react";
import { ShieldCheck, ShieldOff } from "lucide-react";
import type { BackupCodes } from "@betng/contracts";
import { DataSourceError, formatDateTime } from "@betng/ui-core";
import { Badge, Button, Card, FormError, Modal, PasswordInput, SectionHeading, SkeletonRows, useFlag, useToast } from "@betng/ui-web";
import { AccountErrorState } from "../../auth/AccountErrorState";
import { SecondFactorField, isCompleteCode, type SecondFactorMethod } from "../../auth/SecondFactorField";
import { accountServices, logger } from "../../../services/runtime";
import { isNotImplemented, useSetTwoFactorStatus, useTwoFactorStatus } from "../queries";
import { Unavailable } from "../Unavailable";
import { BackupCodesPanel } from "./BackupCodesPanel";
import { TwoFactorSetup } from "./TwoFactorSetup";

function fieldError(error: unknown, field: string): string | undefined {
  return error instanceof DataSourceError && error.code === "VALIDATION" ? error.detail.fields?.[field] : undefined;
}

function DisableDialog({ open, onClose, onDisabled }: { readonly open: boolean; readonly onClose: () => void; readonly onDisabled: () => void }): React.JSX.Element {
  const [password, setPassword] = useState("");
  const [method, setMethod] = useState<SecondFactorMethod>("TOTP");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();

  const close = (): void => {
    setPassword("");
    setCode("");
    setError(undefined);
    onClose();
  };

  const submit = async (): Promise<void> => {
    setBusy(true);
    setError(undefined);

    try {
      await accountServices.security.disableTwoFactor({ password, code: code.trim() });
      setPassword("");
      setCode("");
      onDisabled();
    } catch (cause) {
      logger.warn("auth", "Turning off two-step verification failed", { code: cause instanceof DataSourceError ? cause.code : "UNKNOWN" });
      setCode("");
      setError(cause);
    } finally {
      setBusy(false);
    }
  };

  const ready = password.length > 0 && isCompleteCode(method, code);
  const passwordError = fieldError(error, "password");
  const codeError = fieldError(error, "code");

  return (
    <Modal
      open={open}
      onClose={close}
      dismissible={!busy}
      size="sm"
      title="Turn off two-step verification?"
      description="Anyone with your password could then sign in. Confirm with your password and a current code."
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={busy}>
            Keep it on
          </Button>
          <Button variant="danger" loading={busy} disabled={!ready} onClick={() => void submit()}>
            Turn off
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (ready) void submit();
        }}
      >
        {passwordError === undefined && codeError === undefined && <FormError error={error} />}
        <PasswordInput
          label="Password"
          autoComplete="current-password"
          value={password}
          disabled={busy}
          error={passwordError}
          onChange={(event) => {
            setPassword(event.target.value);
          }}
        />
        <SecondFactorField method={method} onMethod={setMethod} code={code} onCode={setCode} error={codeError} disabled={busy} />
      </form>
    </Modal>
  );
}

function RegenerateDialog({ open, onClose }: { readonly open: boolean; readonly onClose: () => void }): React.JSX.Element {
  const [method, setMethod] = useState<SecondFactorMethod>("TOTP");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [issued, setIssued] = useState<BackupCodes>();

  const close = (): void => {
    setCode("");
    setError(undefined);
    setIssued(undefined);
    onClose();
  };

  const submit = async (): Promise<void> => {
    setBusy(true);
    setError(undefined);

    try {
      setIssued(await accountServices.security.regenerateBackupCodes(code.trim()));
      setCode("");
    } catch (cause) {
      logger.warn("auth", "Backup code regeneration failed", { code: cause instanceof DataSourceError ? cause.code : "UNKNOWN" });
      setCode("");
      setError(cause);
    } finally {
      setBusy(false);
    }
  };

  const codeError = fieldError(error, "code");

  return (
    <Modal
      open={open}
      onClose={close}
      dismissible={!busy && issued === undefined}
      size="md"
      title="New backup codes"
      {...(issued === undefined
        ? {
            description: "Your old backup codes stop working as soon as new ones are issued.",
            footer: (
              <>
                <Button variant="ghost" onClick={close} disabled={busy}>
                  Cancel
                </Button>
                <Button loading={busy} disabled={!isCompleteCode(method, code)} onClick={() => void submit()}>
                  Issue new codes
                </Button>
              </>
            ),
          }
        : {})}
    >
      {issued === undefined ? (
        <div className="space-y-4">
          {codeError === undefined && <FormError error={error} />}
          <SecondFactorField method={method} onMethod={setMethod} code={code} onCode={setCode} error={codeError} disabled={busy} />
        </div>
      ) : (
        <BackupCodesPanel codes={issued.codes} onDone={close} />
      )}
    </Modal>
  );
}

export function TwoFactorSection(): React.JSX.Element {
  const enabled = useFlag("twoFactorEnabled");
  const status = useTwoFactorStatus(enabled);
  const refresh = useSetTwoFactorStatus();
  const { toast } = useToast();
  const [settingUp, setSettingUp] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const header = (badge?: React.ReactNode): React.JSX.Element => (
    <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
      <SectionHeading as="h2">Two-step verification</SectionHeading>
      {badge}
    </div>
  );

  if (!enabled || isNotImplemented(status.error)) {
    return (
      <Card padding="none">
        {header()}
        <Unavailable title="Not available yet" description="Two-step verification is not offered by the platform yet. It will appear here when it is." />
      </Card>
    );
  }

  if (status.data === undefined) {
    return (
      <Card padding="none">
        {header()}
        {status.isError ? <AccountErrorState error={status.error} compact onRetry={() => void status.refetch()} /> : <SkeletonRows rows={2} className="p-4" />}
      </Card>
    );
  }

  const current = status.data;

  return (
    <Card padding="none">
      {header(
        current.enabled ? (
          <Badge tone="success" icon={<ShieldCheck className="size-3" aria-hidden />}>
            On
          </Badge>
        ) : (
          <Badge tone="neutral" icon={<ShieldOff className="size-3" aria-hidden />}>
            Off
          </Badge>
        ),
      )}
      <div className="p-4">
        {current.enabled ? (
          <div className="space-y-4">
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="type-caption">Method</dt>
                <dd className="type-body mt-0.5 text-text-primary">Authenticator app</dd>
              </div>
              {current.enabledAt !== undefined && (
                <div>
                  <dt className="type-caption">Turned on</dt>
                  <dd className="type-data mt-0.5 text-text-primary">{formatDateTime(current.enabledAt)}</dd>
                </div>
              )}
              {current.backupCodesRemaining !== undefined && (
                <div>
                  <dt className="type-caption">Backup codes left</dt>
                  <dd className={current.backupCodesRemaining <= 2 ? "type-data mt-0.5 text-warning" : "type-data mt-0.5 text-text-primary"}>{current.backupCodesRemaining}</dd>
                </div>
              )}
            </dl>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setRegenerating(true);
                }}
              >
                New backup codes
              </Button>
              {!current.required && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setDisabling(true);
                  }}
                >
                  Turn off
                </Button>
              )}
            </div>
          </div>
        ) : settingUp ? (
          <TwoFactorSetup
            onCancel={() => {
              setSettingUp(false);
            }}
            onEnabled={() => {
              setSettingUp(false);
              refresh();
              toast({ tone: "success", title: "Two-step verification is on", message: "You will be asked for a code when you sign in." });
            }}
          />
        ) : (
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="type-small max-w-prose text-text-secondary">Add a code from an authenticator app to every sign-in, so a stolen password is not enough.</p>
            <Button
              onClick={() => {
                setSettingUp(true);
              }}
            >
              Set up
            </Button>
          </div>
        )}
      </div>
      <DisableDialog
        open={disabling}
        onClose={() => {
          setDisabling(false);
        }}
        onDisabled={() => {
          setDisabling(false);
          refresh();
          toast({ tone: "info", title: "Two-step verification is off" });
        }}
      />
      <RegenerateDialog
        open={regenerating}
        onClose={() => {
          setRegenerating(false);
          refresh();
        }}
      />
    </Card>
  );
}
