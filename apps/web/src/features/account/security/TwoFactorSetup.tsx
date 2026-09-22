import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";
import type { BackupCodes, TwoFactorEnrollment } from "@betng/contracts";
import { DataSourceError } from "@betng/ui-core";
import { Button, CodeInput, FormError } from "@betng/ui-web";
import { accountServices, logger } from "../../../services/runtime";
import { BackupCodesPanel } from "./BackupCodesPanel";
import { QrCode } from "./QrCode";

export interface TwoFactorSetupProps {
  readonly onCancel: () => void;
  /** The platform turned two-step verification on and the customer confirmed saving the codes. */
  readonly onEnabled: () => void;
}

type Step = { readonly name: "start" } | { readonly name: "scan"; readonly enrollment: TwoFactorEnrollment } | { readonly name: "codes"; readonly codes: BackupCodes };

export function TwoFactorSetup({ onCancel, onEnabled }: TwoFactorSetupProps): React.JSX.Element {
  const [step, setStep] = useState<Step>({ name: "start" });
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const enrollment = step.name === "scan" ? step.enrollment : undefined;

  useEffect(() => {
    if (enrollment === undefined) return;

    const timer = setTimeout(
      () => {
        setStep({ name: "start" });
        setCode("");
        setError(new DataSourceError("SESSION_EXPIRED", "The setup expired."));
      },
      Math.max(0, Math.min(Date.parse(enrollment.expiresAt) - Date.now(), 2_000_000_000)),
    );

    return () => {
      clearTimeout(timer);
    };
  }, [enrollment]);

  const start = async (): Promise<void> => {
    setBusy(true);
    setError(undefined);

    try {
      setStep({ name: "scan", enrollment: await accountServices.security.startTwoFactorEnrollment() });
    } catch (cause) {
      logger.warn("auth", "Two-step setup could not start", { code: cause instanceof DataSourceError ? cause.code : "UNKNOWN" });
      setError(cause);
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (value: string): Promise<void> => {
    if (enrollment === undefined || busy || value.length !== 6) return;

    setBusy(true);
    setError(undefined);

    try {
      const codes = await accountServices.security.confirmTwoFactor({ enrollmentId: enrollment.enrollmentId, code: value });

      setCode("");
      setStep({ name: "codes", codes });
    } catch (cause) {
      logger.warn("auth", "Two-step confirmation failed", { code: cause instanceof DataSourceError ? cause.code : "UNKNOWN" });
      setCode("");
      setError(cause);
    } finally {
      setBusy(false);
    }
  };

  if (step.name === "codes") {
    return (
      <BackupCodesPanel
        codes={step.codes.codes}
        onDone={() => {
          setStep({ name: "start" });
          onEnabled();
        }}
      />
    );
  }

  if (enrollment === undefined) {
    const expired = error instanceof DataSourceError && error.code === "SESSION_EXPIRED";

    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-subtle text-brand">
            <Smartphone className="size-4.5" aria-hidden />
          </span>
          <p className="type-small text-text-secondary">
            You will need an authenticator app on your phone. We show a QR code to scan, then ask for one code to prove it works.
          </p>
        </div>
        {expired ? (
          <p role="alert" className="type-small text-warning">
            The setup expired before it was finished. Start again to get a new code.
          </p>
        ) : (
          <FormError error={error} />
        )}
        <div className="flex flex-wrap gap-2">
          <Button loading={busy} onClick={() => void start()}>
            Start setup
          </Button>
          <Button variant="ghost" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  const codeError = error instanceof DataSourceError && error.code === "VALIDATION" ? (error.detail.fields?.code ?? "That code is not right. Check the time on your phone and try again.") : undefined;

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void confirm(code);
      }}
    >
      <ol className="type-small list-decimal space-y-1 pl-5 text-text-secondary">
        <li>Open your authenticator app and add an account.</li>
        <li>Scan the QR code, or type the setup key if you cannot scan.</li>
        <li>Enter the 6-digit code the app shows.</li>
      </ol>
      <div className="flex flex-wrap items-start gap-5">
        <QrCode value={enrollment.otpauthUri} label="QR code for your authenticator app" />
        <div className="min-w-0 flex-1 basis-48 space-y-2">
          <p className="type-caption">Setup key</p>
          <p className="break-all rounded-sm border border-border bg-surface-sunken px-3 py-2 font-mono type-data tracking-wider text-text-primary" data-testid="manual-key">
            {enrollment.manualKey}
          </p>
          <p className="type-small text-text-muted">Keep this key private. It is shown only while you set up.</p>
        </div>
      </div>
      {codeError === undefined && <FormError error={error} />}
      <CodeInput label="Code from your app" length={6} value={code} onChange={setCode} onComplete={(value) => void confirm(value)} error={codeError} disabled={busy} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={busy} disabled={code.length !== 6}>
          Turn on
        </Button>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => {
            setStep({ name: "start" });
            onCancel();
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
