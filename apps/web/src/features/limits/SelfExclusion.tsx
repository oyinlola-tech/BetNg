import { useState } from "react";
import { ShieldOff } from "lucide-react";
import type { SelfExclusion as SelfExclusionState, SelfExclusionPeriod } from "@betng/contracts";
import { DataSourceError, formatDateTime } from "@betng/ui-core";
import { Button, Card, Checkbox, Dialog, FormError, PasswordInput, RadioGroup, SectionHeading, useToast } from "@betng/ui-web";
import { logger } from "../../services/runtime";
import { EXCLUSION_LABEL, EXCLUSION_PERIODS } from "./limitMeta";
import { useCancelSelfExclusion, useSelfExclude } from "./limitQueries";

function ConfirmExclusion({ period, onClose }: { readonly period: SelfExclusionPeriod; readonly onClose: () => void }): React.JSX.Element {
  const exclude = useSelfExclude();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [passwordError, setPasswordError] = useState<string>();
  const [failure, setFailure] = useState<unknown>();

  const confirm = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setFailure(undefined);
    setPasswordError(undefined);

    if (password === "") {
      setPasswordError("Enter your password to confirm.");

      return;
    }

    try {
      const result = await exclude.mutateAsync({ period, password });

      setPassword("");
      toast({
        tone: "info",
        title: "Self-exclusion started",
        message: result.endsAt === undefined ? "Betting and deposits are closed on this account." : `Betting and deposits are paused until ${formatDateTime(result.endsAt)}.`,
      });
      onClose();
    } catch (cause) {
      setPassword("");
      logger.warn("flow", "Self-exclusion failed", { code: cause instanceof DataSourceError ? cause.code : "UNKNOWN" });

      const field = cause instanceof DataSourceError ? cause.detail.fields?.password : undefined;

      if (field === undefined) setFailure(cause);
      else setPasswordError(field);
    }
  };

  const busy = exclude.isPending;

  return (
    <form onSubmit={(event) => void confirm(event)} noValidate className="space-y-4">
      <FormError error={failure} />
      <div className="rounded-sm border border-danger/40 bg-danger-subtle px-3 py-2.5">
        <p className="text-sm font-semibold text-danger">{period === "permanent" ? "Permanent self-exclusion" : `Self-exclusion for ${EXCLUSION_LABEL[period]}`}</p>
        <p className="mt-1 text-sm text-text-secondary">
          You will not be able to bet or deposit {period === "permanent" ? "on this account again" : "until it ends"}. It cannot be undone early.
        </p>
      </div>
      <Checkbox
        label="I understand this cannot be reversed early"
        checked={understood}
        disabled={busy}
        onChange={(event) => {
          setUnderstood(event.target.checked);
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
      <div className="flex justify-end gap-2">
        <Button variant="ghost" disabled={busy} onClick={onClose}>
          Keep my account open
        </Button>
        <Button type="submit" variant="danger" loading={busy} disabled={!understood}>
          Self-exclude
        </Button>
      </div>
    </form>
  );
}

export function SelfExclusion({ exclusion }: { readonly exclusion: SelfExclusionState }): React.JSX.Element {
  const [period, setPeriod] = useState<SelfExclusionPeriod>("24h");
  const [confirming, setConfirming] = useState(false);
  const cancel = useCancelSelfExclusion();
  const { toast } = useToast();

  if (exclusion.active) {
    const cancellable = exclusion.canCancelAt !== undefined && Date.parse(exclusion.canCancelAt) <= Date.now();

    return (
      <Card>
        <SectionHeading as="h2">Self-exclusion</SectionHeading>
        <div className="mt-3 flex items-start gap-3">
          <ShieldOff className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
          <div className="space-y-1">
            <p className="type-body font-semibold text-text-primary">
              Active{exclusion.period === undefined ? "" : ` · ${EXCLUSION_LABEL[exclusion.period]}`}
            </p>
            {exclusion.startedAt !== undefined && <p className="type-small text-text-secondary">Started {formatDateTime(exclusion.startedAt)}</p>}
            <p className="type-small text-text-secondary">{exclusion.endsAt === undefined ? "This exclusion does not end." : `Ends ${formatDateTime(exclusion.endsAt)}`}</p>
          </div>
        </div>
        <FormError className="mt-3" error={cancel.error ?? undefined} />
        {cancellable && (
          <Button
            className="mt-4"
            variant="secondary"
            size="sm"
            loading={cancel.isPending}
            onClick={() => {
              cancel.mutate(undefined, {
                onSuccess: () => {
                  toast({ tone: "info", title: "Limit updated", message: "Your self-exclusion has ended." });
                },
              });
            }}
          >
            End self-exclusion
          </Button>
        )}
      </Card>
    );
  }

  return (
    <Card>
      <SectionHeading as="h2">Self-exclusion</SectionHeading>
      <p className="type-small mt-1 text-text-secondary">Take a break from betting and deposits. Once started, it cannot be undone early.</p>
      <RadioGroup className="mt-4" legend="How long" value={period} onChange={setPeriod} options={EXCLUSION_PERIODS} />
      <div className="mt-4 flex justify-end">
        <Button
          variant="danger"
          onClick={() => {
            setConfirming(true);
          }}
        >
          Self-exclude
        </Button>
      </div>
      <Dialog
        open={confirming}
        onClose={() => {
          setConfirming(false);
        }}
        title="Confirm self-exclusion"
        size="sm"
      >
        {confirming && (
          <ConfirmExclusion
            period={period}
            onClose={() => {
              setConfirming(false);
            }}
          />
        )}
      </Dialog>
    </Card>
  );
}
