import { useRef, useState } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2 } from "lucide-react";
import type { AccountDeletion } from "@betng/contracts";
import { DataSourceError, createIdempotencyKey, formatDateTime } from "@betng/ui-core";
import { Button, Card, ConfirmationDialog, FormError, Input, Modal, PasswordInput, ProfileSkeleton, SectionHeading, Textarea, useFlag, useToast } from "@betng/ui-web";
import { isNotImplemented, useDeletion, useSetDeletion } from "../features/account/queries";
import { Unavailable } from "../features/account/Unavailable";
import { AccountErrorState, useLogoutFlow } from "../features/auth";
import { usePageMeta } from "../features/seo";
import { accountServices, logger } from "../services/runtime";

const CONFIRM_WORD = "DELETE";

function RequestForm({ onResult }: { readonly onResult: (next: AccountDeletion) => void }): React.JSX.Element {
  const [reason, setReason] = useState("");
  const [password, setPassword] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  /* One key per deletion request, reused if the same request is retried after a failure. */
  const key = useRef<string | undefined>(undefined);

  const submit = async (): Promise<void> => {
    key.current ??= createIdempotencyKey();
    setBusy(true);
    setError(undefined);

    try {
      const trimmed = reason.trim();
      const next = await accountServices.security.requestDeletion({ password, ...(trimmed === "" ? {} : { reason: trimmed }) }, key.current);

      key.current = undefined;
      setPassword("");
      setConfirming(false);
      onResult(next);
    } catch (cause) {
      logger.warn("flow", "Account deletion request failed", { code: cause instanceof DataSourceError ? cause.code : "UNKNOWN" });
      setError(cause);
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  const passwordError = error instanceof DataSourceError && error.code === "VALIDATION" ? error.detail.fields?.["password"] : undefined;

  return (
    <Card>
      <SectionHeading as="h2">Delete your account</SectionHeading>
      <div className="mt-3 flex items-start gap-2 rounded-sm border border-danger/40 bg-danger-subtle px-3 py-2 text-sm text-text-primary">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
        <p>
          Deleting closes your account for good. The platform schedules it, may keep records it is required to keep, and will tell you if something such as an open bet or a
          pending payment has to finish first. You can cancel while it is pending.
        </p>
      </div>
      <form
        noValidate
        className="mt-4 max-w-md space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (password !== "") {
            setTyped("");
            setConfirming(true);
          }
        }}
      >
        {passwordError === undefined && <FormError error={error} />}
        <Textarea
          label="Why are you leaving? (optional)"
          maxLength={500}
          value={reason}
          disabled={busy}
          onChange={(event) => {
            setReason(event.target.value);
          }}
        />
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
        <Button type="submit" variant="danger" disabled={password === ""} loading={busy && !confirming}>
          Request deletion
        </Button>
      </form>
      <Modal
        open={confirming}
        onClose={() => {
          setConfirming(false);
        }}
        dismissible={!busy}
        size="sm"
        title="Delete your account?"
        description="This cannot be undone once the platform completes it. Your bets, history and wallet will no longer be available to you."
        footer={
          <>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setConfirming(false);
              }}
            >
              Keep my account
            </Button>
            <Button variant="danger" loading={busy} disabled={typed.trim() !== CONFIRM_WORD} onClick={() => void submit()}>
              Delete account
            </Button>
          </>
        }
      >
        <Input
          label={`Type ${CONFIRM_WORD} to confirm`}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          value={typed}
          disabled={busy}
          onChange={(event) => {
            setTyped(event.target.value);
          }}
        />
      </Modal>
    </Card>
  );
}

function PendingState({ deletion, onResult }: { readonly deletion: AccountDeletion; readonly onResult: (next: AccountDeletion) => void }): React.JSX.Element {
  const { toast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const blockers = deletion.blockers ?? [];

  const cancel = async (): Promise<void> => {
    setBusy(true);
    setError(undefined);

    try {
      onResult(await accountServices.security.cancelDeletion());
      toast({ tone: "success", title: "Deletion cancelled", message: "Your account stays open." });
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <Card>
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-warning-subtle text-warning">
          <CalendarClock className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <SectionHeading as="h2">Deletion requested</SectionHeading>
          <p className="type-body mt-2 text-text-secondary">
            Your account is still open.{" "}
            {deletion.scheduledFor === undefined ? "The platform has not scheduled the deletion yet." : `The platform plans to delete it on ${formatDateTime(deletion.scheduledFor)}.`}
          </p>
          {deletion.requestedAt !== undefined && <p className="type-small mt-1 text-text-muted">Requested {formatDateTime(deletion.requestedAt)}</p>}
        </div>
      </div>
      {blockers.length > 0 && (
        <div className="mt-4 rounded-sm border border-border bg-surface-sunken px-3 py-2">
          <p className="type-caption">Waiting on</p>
          <ul className="type-small mt-1 list-disc space-y-0.5 pl-5 text-text-secondary">
            {blockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        </div>
      )}
      <FormError error={error} className="mt-3" />
      {deletion.cancellable && (
        <Button
          variant="secondary"
          className="mt-4"
          onClick={() => {
            setConfirming(true);
          }}
        >
          Cancel deletion
        </Button>
      )}
      <ConfirmationDialog
        open={confirming}
        onClose={() => {
          setConfirming(false);
        }}
        title="Keep your account?"
        description="The deletion request is withdrawn and your account stays open."
        confirmLabel="Cancel deletion"
        cancelLabel="Back"
        loading={busy}
        onConfirm={cancel}
      />
    </Card>
  );
}

function CompletedState(): React.JSX.Element {
  const logout = useLogoutFlow();

  return (
    <Card>
      <div role="status" className="flex flex-col items-center gap-3 py-6 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-success-subtle text-success">
          <CheckCircle2 className="size-6" aria-hidden />
        </span>
        <p className="type-h3">Your account has been deleted</p>
        <p className="type-small max-w-sm text-text-secondary">The platform has closed your account. Sign out to clear this browser.</p>
        <Button onClick={logout.request}>Sign out</Button>
      </div>
      {logout.dialog}
    </Card>
  );
}

export function AccountDeletionPage(): React.JSX.Element {
  usePageMeta({ title: "Delete account", noindex: true });

  const enabled = useFlag("accountDeletionEnabled");
  const deletion = useDeletion(enabled);
  const setDeletion = useSetDeletion();

  if (!enabled || isNotImplemented(deletion.error)) {
    return (
      <Card padding="none">
        <Unavailable title="Not available yet" description="Deleting your account from here is not offered by the platform yet. Contact support to close your account." />
      </Card>
    );
  }

  if (deletion.data === undefined) {
    return deletion.isError ? (
      <Card padding="none">
        <AccountErrorState error={deletion.error} onRetry={() => void deletion.refetch()} />
      </Card>
    ) : (
      <ProfileSkeleton fields={3} />
    );
  }

  const current = deletion.data;

  switch (current.status) {
    case "COMPLETED":
      return <CompletedState />;
    case "REQUESTED":
    case "PENDING":
      return <PendingState deletion={current} onResult={setDeletion} />;
    default:
      return <RequestForm onResult={setDeletion} />;
  }
}
