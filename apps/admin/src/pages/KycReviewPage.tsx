import { useState } from "react";
import { Check, ExternalLink, FileText, MessageSquareWarning, X } from "lucide-react";
import type { KycDocument, KycReviewDecision, KycReviewItem } from "@betng/contracts";
import { formatDateTime, formatRelative } from "@betng/ui-core";
import { Avatar, Button, Drawer, Panel, presentError, useLogger, useToast, type Column } from "@betng/ui-web";
import { AdminListTable } from "../components/AdminListTable";
import { DetailItem, Mono } from "../components/Bits";
import { AuditNote, KYC_STATUS_OPTIONS, KycStatusBadge, PendingNote, ServiceNotDeployed, isNotImplemented } from "../components/ComplianceBits";
import { GuardedButton } from "../components/Guard";
import { PageHeader } from "../components/PageHeader";
import { useReasonAction } from "../components/ReasonAction";
import { useKycQueue } from "../hooks/compliance";
import { useAdminAction } from "../hooks/queries";
import { humanise } from "../lib/format";
import { compliance } from "../services/runtime";

const COLUMNS: readonly Column<KycReviewItem>[] = [
  {
    key: "customer",
    header: "Customer",
    hideable: false,
    cell: (k) => (
      <span className="flex items-center gap-2.5">
        <Avatar name={k.displayName} size="sm" />
        <span className="min-w-0">
          <span className="block truncate font-medium">{k.displayName}</span>
          <span className="block truncate text-sm text-text-muted">{k.email}</span>
        </span>
      </span>
    ),
  },
  { key: "status", header: "Status", cell: (k) => <KycStatusBadge value={k.status} /> },
  { key: "tier", header: "Tier", cell: (k) => <Mono>{k.tier.replace("_", " ")}</Mono>, hideBelow: "md" },
  { key: "documents", header: "Documents", numeric: true, cell: (k) => k.documents.length, hideBelow: "lg" },
  { key: "submittedAt", header: "Submitted", cell: (k) => <span className="whitespace-nowrap text-text-secondary" title={formatDateTime(k.submittedAt)}>{formatRelative(k.submittedAt)}</span> },
];

const DECISIONS: readonly { readonly decision: KycReviewDecision["decision"]; readonly label: string; readonly verb: string; readonly tone: "primary" | "danger"; readonly icon: React.ReactNode; readonly consequence: string }[] = [
  { decision: "APPROVE", label: "Approve", verb: "Approve verification", tone: "primary", icon: <Check className="size-4" aria-hidden />, consequence: "The customer is verified at the tier the platform assigns and the limits for that tier apply." },
  { decision: "REQUEST_ACTION", label: "Request action", verb: "Request action", tone: "primary", icon: <MessageSquareWarning className="size-4" aria-hidden />, consequence: "The customer is asked to resubmit. Your reason is shown to them as the next step." },
  { decision: "REJECT", label: "Reject", verb: "Reject verification", tone: "danger", icon: <X className="size-4" aria-hidden />, consequence: "The submission is rejected. Withdrawals and higher limits stay locked until a new submission is approved." },
];

const reviewable = (item: KycReviewItem): boolean => item.status === "PENDING" || item.status === "REQUIRES_ACTION";

function DocumentRow({ document }: { readonly document: KycDocument }): React.JSX.Element {
  const logger = useLogger();
  const { toast } = useToast();
  const [opening, setOpening] = useState(false);
  const [pending, setPending] = useState(false);

  /* The signed URL is fetched on each click and handed straight to a new tab; it is never cached, stored or logged. */
  const open = async (): Promise<void> => {
    setOpening(true);

    try {
      const preview = await compliance.previewKycDocument(document.id);
      let secure = false;

      try {
        secure = new URL(preview.url).protocol === "https:";
      } catch {
        secure = false;
      }

      if (!secure) {
        logger.warn("flow", "A document preview was refused: not served over https");
        toast({ tone: "danger", title: "Preview refused", message: "The platform answered a document link that is not secure, so it was not opened." });

        return;
      }

      window.open(preview.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      if (isNotImplemented(error)) {
        setPending(true);

        return;
      }

      const presented = presentError(error);

      logger.warn("flow", "A document preview failed", { code: presented.code ?? "UNKNOWN" });
      toast({ tone: "danger", title: presented.title, message: presented.message });
    } finally {
      setOpening(false);
    }
  };

  return (
    <li className="space-y-1.5 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <FileText className="size-4 shrink-0 text-text-muted" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-text-primary">{humanise(document.type)}</span>
          <span className="block truncate text-sm text-text-muted">
            {document.fileName} · {(document.sizeBytes / 1_048_576).toFixed(1)} MB · uploaded {formatRelative(document.uploadedAt)}
          </span>
        </span>
        <KycStatusBadge value={document.status} />
        <Button variant="secondary" size="sm" loading={opening} leadingIcon={<ExternalLink className="size-3.5" aria-hidden />} onClick={() => void open()} aria-label={`View ${humanise(document.type)} document`}>
          View document
        </Button>
      </div>
      {document.rejectionReason !== undefined && <p className="text-sm text-text-secondary">Reason recorded: {document.rejectionReason}</p>}
      {pending && <PendingNote>Document previews are served by the platform's document store, which is not available yet. Nothing was opened.</PendingNote>}
    </li>
  );
}

export function KycReviewPage(): React.JSX.Element {
  const list = useKycQueue();
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const selected = list.query.data?.items.find((k) => k.userId === selectedId);
  const { ask, dialog } = useReasonAction();
  const review = useAdminAction({
    run: (input: { readonly userId: string; readonly decision: KycReviewDecision }) => compliance.reviewKyc(input.userId, input.decision),
    success: (item) => `${item.displayName}: ${humanise(item.status)}`,
  });

  return (
    <>
      <PageHeader title="KYC review" description="Identity submissions waiting on an operator. The platform runs BVN, NIN and document checks; decisions here are re-authorised and audit-logged by the platform." />
      {isNotImplemented(list.query.error) ? (
        <ServiceNotDeployed what="the KYC review queue" />
      ) : (
        <Panel flush>
          <AdminListTable
            list={list}
            caption="KYC review queue"
            noun="submissions"
            columns={COLUMNS}
            rowKey={(k) => k.userId}
            search={{ label: "Search submissions by name or email", placeholder: "Search name, email" }}
            filters={[{ key: "status", label: "Status", anyLabel: "All statuses", options: KYC_STATUS_OPTIONS }]}
            onRowClick={(k) => setSelectedId(k.userId)}
            selectedKey={selectedId}
            renderCard={(k) => (
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{k.displayName}</span>
                  <span className="block truncate text-sm text-text-muted">{k.email}</span>
                </span>
                <KycStatusBadge value={k.status} />
              </div>
            )}
          />
        </Panel>
      )}

      <Drawer
        open={selected !== undefined}
        onClose={() => setSelectedId(undefined)}
        size="lg"
        title={selected?.displayName ?? ""}
        description={selected?.email ?? ""}
        footer={
          selected !== undefined && (
            <div className="flex w-full flex-wrap justify-end gap-2">
              {DECISIONS.map((d) => (
                <GuardedButton
                  key={d.decision}
                  permission="kyc:write"
                  variant={d.tone === "danger" ? "danger" : d.decision === "APPROVE" ? "primary" : "secondary"}
                  leadingIcon={d.icon}
                  blockedReason={reviewable(selected) ? undefined : "Only a pending submission can be reviewed"}
                  onClick={() =>
                    ask({
                      title: `${d.verb} for ${selected.displayName}?`,
                      description: d.consequence,
                      confirmLabel: d.verb,
                      tone: d.tone,
                      details: <AuditNote>Your decision and reason are recorded in the platform's audit log against your account.</AuditNote>,
                      run: (reason) => review.mutateAsync({ userId: selected.userId, decision: { decision: d.decision, reason: reason.trim().slice(0, 300) } }),
                    })
                  }
                >
                  {d.label}
                </GuardedButton>
              ))}
            </div>
          )
        }
      >
        {selected !== undefined && (
          <div className="space-y-5">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
              <DetailItem label="Status">
                <KycStatusBadge value={selected.status} />
              </DetailItem>
              <DetailItem label="Tier">
                <Mono className="text-text-primary">{selected.tier.replace("_", " ")}</Mono>
              </DetailItem>
              <DetailItem label="Submitted">{formatDateTime(selected.submittedAt)}</DetailItem>
              <DetailItem label="Customer ID">
                <Mono className="whitespace-normal break-all">{selected.userId}</Mono>
              </DetailItem>
            </dl>
            <section aria-labelledby="kyc-documents">
              <h3 id="kyc-documents" className="type-section mb-2">
                Documents
              </h3>
              {selected.documents.length === 0 ? (
                <p className="text-sm text-text-muted">The platform lists no documents for this submission.</p>
              ) : (
                <ul className="divide-y divide-border rounded-md border border-border">
                  {selected.documents.map((doc) => (
                    <DocumentRow key={doc.id} document={doc} />
                  ))}
                </ul>
              )}
            </section>
            <AuditNote>Decisions are re-authorised and audit-logged by the platform. Document links are short-lived, open in a new tab and are never kept by this console.</AuditNote>
          </div>
        )}
      </Drawer>
      {dialog}
    </>
  );
}
