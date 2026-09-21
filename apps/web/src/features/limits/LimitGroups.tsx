import { useState } from "react";
import { CalendarClock, Clock3, Gauge, Wallet } from "lucide-react";
import type { LimitKind, ResponsibleGamingLimit } from "@betng/contracts";
import { DataSourceError, formatDateTime } from "@betng/ui-core";
import { Button, Card, ConfirmDialog, FormError, SectionHeading, StatusBadge, useToast } from "@betng/ui-web";
import { logger } from "../../services/runtime";
import { DEPOSIT_KINDS, LIMIT_LABEL, LIMIT_STATUS, LOSS_KINDS, SESSION_KINDS, formatLimitValue } from "./limitMeta";
import { useRemoveLimit } from "./limitQueries";
import { SetLimitDialog } from "./SetLimitDialog";

function Usage({ limit }: { readonly limit: ResponsibleGamingLimit }): React.JSX.Element | null {
  if (limit.used === undefined) return null;

  const percent = limit.value > 0 ? Math.min(100, Math.round((limit.used / limit.value) * 100)) : 0;

  return (
    <div className="mt-2 space-y-1">
      <p className="type-small text-text-secondary">
        Used <span className="type-financial text-text-primary">{formatLimitValue(limit.kind, limit.used)}</span> of {formatLimitValue(limit.kind, limit.value)}
      </p>
      <div role="meter" aria-label={`${LIMIT_LABEL[limit.kind]} used`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-1.5 max-w-xs overflow-hidden rounded-full bg-surface-sunken">
        <div className={percent >= 90 ? "h-full bg-warning" : "h-full bg-brand"} style={{ width: `${String(percent)}%` }} />
      </div>
    </div>
  );
}

/** Active, pending, requested and expired read differently, and a pending change always says when it takes effect. */
export function LimitRow({ kind, limit, onEdit, onRemove }: { readonly kind: LimitKind; readonly limit: ResponsibleGamingLimit | undefined; readonly onEdit: () => void; readonly onRemove: () => void }): React.JSX.Element {
  const status = limit === undefined ? undefined : LIMIT_STATUS[limit.status];
  const removalRequested = limit !== undefined && limit.pendingValue === undefined && limit.pendingEffectiveAt !== undefined;

  return (
    <li className="px-4 py-3" data-testid={`limit-${kind}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="type-body flex flex-wrap items-center gap-2 font-semibold text-text-primary">
            {LIMIT_LABEL[kind]}
            {status !== undefined && <StatusBadge tone={status.tone}>{status.label}</StatusBadge>}
          </p>
          <p className="type-financial mt-1 text-left text-lg text-text-primary">{limit === undefined ? <span className="type-body text-text-muted">No limit set</span> : formatLimitValue(kind, limit.value)}</p>
        </div>
        <div className="flex gap-1.5">
          <Button variant="secondary" size="sm" onClick={onEdit}>
            {limit === undefined ? "Set limit" : "Change"}
          </Button>
          {limit !== undefined && limit.status !== "expired" && !removalRequested && (
            <Button variant="ghost" size="sm" onClick={onRemove}>
              Remove
            </Button>
          )}
        </div>
      </div>
      {limit !== undefined && (
        <>
          <Usage limit={limit} />
          {limit.resetsAt !== undefined && (
            <p className="type-small mt-1.5 flex items-center gap-1.5 text-text-muted">
              <Clock3 className="size-3.5" aria-hidden />
              Resets {formatDateTime(limit.resetsAt)}
            </p>
          )}
          {limit.pendingValue !== undefined && limit.pendingEffectiveAt !== undefined && (
            <p className="type-small mt-1.5 flex items-start gap-1.5 text-text-secondary" data-testid={`limit-${kind}-pending`}>
              <CalendarClock className="mt-0.5 size-3.5 shrink-0 text-pending" aria-hidden />
              <span>
                Changing to <span className="type-financial text-text-primary">{formatLimitValue(kind, limit.pendingValue)}</span>. Takes effect on {formatDateTime(limit.pendingEffectiveAt)}. Until then {formatLimitValue(kind, limit.value)} applies.
              </span>
            </p>
          )}
          {removalRequested && limit.pendingEffectiveAt !== undefined && (
            <p className="type-small mt-1.5 flex items-start gap-1.5 text-text-secondary">
              <CalendarClock className="mt-0.5 size-3.5 shrink-0 text-pending" aria-hidden />
              <span>Removal requested. The limit stays in force until {formatDateTime(limit.pendingEffectiveAt)}.</span>
            </p>
          )}
          {limit.status === "expired" && <p className="type-small mt-1.5 text-text-muted">This limit no longer applies.</p>}
        </>
      )}
    </li>
  );
}

interface LimitGroupProps {
  readonly title: string;
  readonly description: string;
  readonly icon: React.ReactNode;
  readonly kinds: readonly LimitKind[];
  readonly limits: readonly ResponsibleGamingLimit[];
}

function LimitGroup({ title, description, icon, kinds, limits }: LimitGroupProps): React.JSX.Element {
  const [editing, setEditing] = useState<LimitKind>();
  const [removing, setRemoving] = useState<LimitKind>();
  const remove = useRemoveLimit();
  const { toast } = useToast();
  const find = (kind: LimitKind): ResponsibleGamingLimit | undefined => limits.find((limit) => limit.kind === kind);

  return (
    <Card padding="none">
      <div className="flex items-start gap-3 border-b border-border px-4 py-3">
        <span aria-hidden className="mt-0.5 text-text-muted">
          {icon}
        </span>
        <div>
          <SectionHeading as="h2">{title}</SectionHeading>
          <p className="type-small mt-0.5 text-text-muted">{description}</p>
        </div>
      </div>
      {remove.error !== null && <FormError className="m-4" error={remove.error} />}
      <ul className="divide-y divide-border">
        {kinds.map((kind) => (
          <LimitRow
            key={kind}
            kind={kind}
            limit={find(kind)}
            onEdit={() => {
              setEditing(kind);
            }}
            onRemove={() => {
              remove.reset();
              setRemoving(kind);
            }}
          />
        ))}
      </ul>
      <SetLimitDialog
        kind={editing}
        current={editing === undefined ? undefined : find(editing)}
        onClose={() => {
          setEditing(undefined);
        }}
      />
      <ConfirmDialog
        open={removing !== undefined}
        title="Remove limit"
        confirmLabel="Request removal"
        loading={remove.isPending}
        description={
          removing === undefined
            ? ""
            : `Removing your ${LIMIT_LABEL[removing].toLowerCase()} is not immediate: it stays in force for a cooling-off period set by the platform.`
        }
        onClose={() => {
          setRemoving(undefined);
        }}
        onConfirm={async () => {
          if (removing === undefined) return;

          try {
            await remove.mutateAsync(removing);
            toast({ tone: "info", title: "Limit updated", message: `Removal of your ${LIMIT_LABEL[removing].toLowerCase()} was requested.` });
          } catch (cause) {
            logger.warn("flow", "Removing a limit failed", { kind: removing, code: cause instanceof DataSourceError ? cause.code : "UNKNOWN" });
          } finally {
            setRemoving(undefined);
          }
        }}
      />
    </Card>
  );
}

export function DepositLimits({ limits }: { readonly limits: readonly ResponsibleGamingLimit[] }): React.JSX.Element {
  return <LimitGroup title="Deposit limits" description="The most you can deposit in a day, week or month." icon={<Wallet className="size-4" />} kinds={DEPOSIT_KINDS} limits={limits} />;
}

export function LossLimits({ limits }: { readonly limits: readonly ResponsibleGamingLimit[] }): React.JSX.Element {
  return <LimitGroup title="Loss limits" description="The most you can lose from betting in a day or week." icon={<Gauge className="size-4" />} kinds={LOSS_KINDS} limits={limits} />;
}

export function SessionLimits({ limits }: { readonly limits: readonly ResponsibleGamingLimit[] }): React.JSX.Element {
  return <LimitGroup title="Session limits" description="How long a single session on BETNG can last." icon={<Clock3 className="size-4" />} kinds={SESSION_KINDS} limits={limits} />;
}

