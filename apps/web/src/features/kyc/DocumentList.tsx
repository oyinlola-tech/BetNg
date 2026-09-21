import { FileText } from "lucide-react";
import type { KycDocument } from "@betng/contracts";
import { formatDateTime } from "@betng/ui-core";
import { EmptyState } from "@betng/ui-web";
import { DOCUMENT_LABEL, formatBytes } from "./kycMeta";
import { KycStatusBadge } from "./KycStatusBadge";

export function DocumentStatus({ document }: { readonly document: KycDocument }): React.JSX.Element {
  return (
    <div className="flex flex-col items-end gap-1 text-right">
      <KycStatusBadge status={document.status} />
      {document.reviewedAt !== undefined && <span className="type-small text-text-muted">Reviewed {formatDateTime(document.reviewedAt)}</span>}
    </div>
  );
}

export function DocumentList({ documents }: { readonly documents: readonly KycDocument[] }): React.JSX.Element {
  if (documents.length === 0) {
    return <EmptyState compact icon={<FileText className="size-5" />} title="No documents yet" description="Documents you upload are listed here with their review status." />;
  }

  return (
    <ul className="divide-y divide-border" aria-label="Uploaded documents">
      {documents.map((document) => (
        <li key={document.id} className="px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="type-body font-semibold text-text-primary">{DOCUMENT_LABEL[document.type]}</p>
              <p className="type-small truncate text-text-muted">
                {document.fileName} · {formatBytes(document.sizeBytes)} · uploaded {formatDateTime(document.uploadedAt)}
              </p>
            </div>
            <DocumentStatus document={document} />
          </div>
          {document.rejectionReason !== undefined && (
            <p className="type-small mt-2 rounded-sm border border-border bg-surface-sunken px-3 py-2 text-text-secondary">
              <span className="font-semibold text-text-primary">Reason: </span>
              {document.rejectionReason}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
