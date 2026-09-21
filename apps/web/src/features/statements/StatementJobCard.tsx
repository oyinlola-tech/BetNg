import { Download, FileText, Loader2, RefreshCw } from "lucide-react";
import type { StatementJob } from "@betng/contracts";
import { formatDateTime, formatShortDate } from "@betng/ui-core";
import { Button, Card, StatusBadge } from "@betng/ui-web";
import { STATEMENT_STATUS, safeDownloadUrl } from "./statementMeta";

export interface StatementJobCardProps {
  readonly job: StatementJob;
  readonly apiUrl: string;
  readonly allowedHosts: readonly string[];
  readonly checking: boolean;
  readonly onCheck: () => void;
}

export function StatementJobCard({ job, apiUrl, allowedHosts, checking, onCheck }: StatementJobCardProps): React.JSX.Element {
  const meta = STATEMENT_STATUS[job.status];
  const href = job.status === "READY" ? safeDownloadUrl(job.downloadUrl, apiUrl, allowedHosts) : undefined;

  return (
    <Card padding="none" aria-live="polite">
      <div className="flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="flex min-w-0 items-start gap-3">
          <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-surface-sunken text-text-muted">
            <FileText className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="type-body font-semibold text-text-primary">
              {job.format} statement · {formatShortDate(`${job.from}T12:00:00Z`)} to {formatShortDate(`${job.to}T12:00:00Z`)}
            </p>
            <p className="type-small mt-0.5 text-text-muted">
              Requested {formatDateTime(job.createdAt)}
              {job.expiresAt !== undefined && job.status === "READY" && ` · link expires ${formatDateTime(job.expiresAt)}`}
            </p>
          </div>
        </div>
        <StatusBadge tone={meta.tone} {...(job.status === "QUEUED" ? { icon: Loader2 } : { status: job.status })}>
          {meta.label}
        </StatusBadge>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-border bg-surface-sunken px-4 py-3">
        {job.status === "QUEUED" && (
          <>
            <p className="type-small flex-1 text-text-secondary">The platform is preparing your statement. This page checks for it automatically.</p>
            <Button variant="secondary" size="sm" loading={checking} leadingIcon={<RefreshCw className="size-3.5" aria-hidden />} onClick={onCheck}>
              Check status
            </Button>
          </>
        )}
        {job.status === "READY" &&
          (href === undefined ? (
            <p role="alert" className="type-small text-danger">
              The download link could not be verified, so it is not shown. Request the statement again or contact support with reference <span className="font-mono">{job.id}</span>.
            </p>
          ) : (
            <a
              href={href}
              rel="noopener noreferrer"
              target="_blank"
              className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-brand bg-brand px-3 text-sm font-semibold text-text-on-brand hover:bg-brand-hover focus-ring"
            >
              <Download className="size-3.5" aria-hidden />
              Download {job.format}
            </a>
          ))}
        {job.status === "FAILED" && <p className="type-small text-text-secondary">The platform could not prepare this statement. Request it again.</p>}
        {job.status === "EXPIRED" && <p className="type-small text-text-secondary">This download has expired. Request the statement again.</p>}
      </div>
    </Card>
  );
}
