import { useEffect, useId, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FileUp, RotateCcw, X } from "lucide-react";
import { KYC_ACCEPTED_TYPES, KYC_MAX_BYTES, type KycDocumentType } from "@betng/contracts";
import { DataSourceError, type UploadProgress } from "@betng/ui-core";
import { Button, FormError, cn, useToast } from "@betng/ui-web";
import { keys } from "../../lib/queryKeys";
import { accountServices, logger } from "../../services/runtime";
import { DOCUMENT_LABEL, DOCUMENT_TYPES, formatBytes } from "./kycMeta";

type Upload =
  | { readonly phase: "idle" }
  | { readonly phase: "uploading"; readonly progress: UploadProgress | undefined }
  | { readonly phase: "failed"; readonly error: unknown }
  | { readonly phase: "cancelled" }
  | { readonly phase: "done" };

/** Client-side checks only save a wasted upload; the platform checks the file again. */
export function checkDocumentFile(file: File): string | undefined {
  if (!(KYC_ACCEPTED_TYPES as readonly string[]).includes(file.type)) return "Upload a JPEG, PNG or PDF file.";
  if (file.size === 0) return "That file is empty.";
  if (file.size > KYC_MAX_BYTES) return `The file must be ${formatBytes(KYC_MAX_BYTES)} or smaller.`;

  return undefined;
}

export function DocumentUpload(): React.JSX.Element {
  const id = useId();
  const client = useQueryClient();
  const { toast } = useToast();
  const [type, setType] = useState<KycDocumentType>("NATIONAL_ID");
  const [file, setFile] = useState<File>();
  const [fileError, setFileError] = useState<string>();
  const [upload, setUpload] = useState<Upload>({ phase: "idle" });
  const [dragging, setDragging] = useState(false);
  const controller = useRef<AbortController | undefined>(undefined);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const choose = (next: File | undefined): void => {
    setUpload({ phase: "idle" });

    if (next === undefined) {
      setFile(undefined);
      setFileError(undefined);

      return;
    }

    const problem = checkDocumentFile(next);

    setFileError(problem);
    setFile(problem === undefined ? next : undefined);
    if (problem !== undefined && input.current !== null) input.current.value = "";
  };

  const start = async (): Promise<void> => {
    if (file === undefined) {
      setFileError("Choose a file to upload.");

      return;
    }

    const abort = new AbortController();

    controller.current = abort;
    setUpload({ phase: "uploading", progress: undefined });

    try {
      await accountServices.kyc.uploadDocument({
        type,
        file,
        signal: abort.signal,
        onProgress: (progress) => {
          if (!abort.signal.aborted) setUpload({ phase: "uploading", progress });
        },
      });

      setUpload({ phase: "done" });
      setFile(undefined);
      if (input.current !== null) input.current.value = "";
      toast({ kind: "wallet", tone: "info", title: "KYC submitted", message: `${DOCUMENT_LABEL[type]} sent for review.` });
    } catch (cause) {
      if (abort.signal.aborted) {
        setUpload({ phase: "cancelled" });
      } else {
        logger.warn("flow", "KYC document upload failed", { code: cause instanceof DataSourceError ? cause.code : "UNKNOWN" });
        setUpload({ phase: "failed", error: cause });
      }
    } finally {
      controller.current = undefined;
      void client.invalidateQueries({ queryKey: keys.kycRoot });
    }
  };

  const uploading = upload.phase === "uploading";
  const percent = upload.phase === "uploading" && upload.progress !== undefined && upload.progress.total > 0 ? Math.round((upload.progress.loaded / upload.progress.total) * 100) : undefined;

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor={`${id}-type`} className="mb-1.5 block text-sm font-medium text-text-secondary">
          Document type
        </label>
        <select
          id={`${id}-type`}
          value={type}
          disabled={uploading}
          onChange={(event) => {
            setType(event.target.value as KycDocumentType);
          }}
          className="h-10 w-full rounded-sm border border-border bg-surface-sunken px-3 text-base text-text-primary focus-ring"
        >
          {DOCUMENT_TYPES.map((value) => (
            <option key={value} value={value}>
              {DOCUMENT_LABEL[value]}
            </option>
          ))}
        </select>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!uploading) setDragging(true);
        }}
        onDragLeave={() => {
          setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!uploading) choose(event.dataTransfer.files[0]);
        }}
        className={cn(
          "flex flex-col items-center gap-2 rounded-md border border-dashed px-4 py-6 text-center transition-colors",
          dragging ? "border-brand bg-brand-subtle" : "border-border-strong bg-surface-sunken",
        )}
      >
        <FileUp className="size-5 text-text-muted" aria-hidden />
        <p className="type-body text-text-primary">{file === undefined ? "Drag a file here, or" : file.name}</p>
        {file !== undefined && <p className="type-small text-text-muted">{formatBytes(file.size)}</p>}
        <label htmlFor={`${id}-file`} className={cn("type-small cursor-pointer rounded-xs font-semibold text-brand hover:underline focus-within:outline-2", uploading && "pointer-events-none opacity-50")}>
          {file === undefined ? "Choose a file" : "Choose a different file"}
          <input
            ref={input}
            id={`${id}-file`}
            type="file"
            accept={KYC_ACCEPTED_TYPES.join(",")}
            disabled={uploading}
            aria-describedby={`${id}-file-hint${fileError === undefined ? "" : ` ${id}-file-error`}`}
            aria-invalid={fileError !== undefined}
            className="sr-only"
            onChange={(event) => {
              choose(event.target.files?.[0]);
            }}
          />
        </label>
        <p id={`${id}-file-hint`} className="type-small text-text-muted">
          JPEG, PNG or PDF, up to {formatBytes(KYC_MAX_BYTES)}. Make sure every corner is visible and the text is readable.
        </p>
        {fileError !== undefined && (
          <p id={`${id}-file-error`} role="alert" className="type-small font-medium text-danger">
            {fileError}
          </p>
        )}
      </div>

      {upload.phase === "uploading" && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="type-small text-text-secondary">{percent === undefined ? "Preparing upload…" : `Uploading… ${String(percent)}%`}</span>
            <Button
              variant="ghost"
              size="xs"
              leadingIcon={<X className="size-3" aria-hidden />}
              onClick={() => {
                controller.current?.abort();
              }}
            >
              Cancel upload
            </Button>
          </div>
          <div role="progressbar" aria-label="Upload progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent ?? 0} className="h-1.5 overflow-hidden rounded-full bg-surface-sunken">
            <div className="h-full bg-brand transition-[width] duration-[var(--bn-duration-fast)]" style={{ width: `${String(percent ?? 0)}%` }} />
          </div>
        </div>
      )}
      {upload.phase === "failed" && <FormError error={upload.error} />}
      {upload.phase === "cancelled" && (
        <p role="status" className="type-small text-text-secondary">
          Upload cancelled. Nothing was submitted.
        </p>
      )}
      {upload.phase === "done" && (
        <p role="status" className="type-small text-text-secondary">
          Document received. It is now waiting for review; the status below updates when the platform reviews it.
        </p>
      )}

      <div className="flex justify-end gap-2">
        {(upload.phase === "failed" || upload.phase === "cancelled") && file !== undefined ? (
          <Button leadingIcon={<RotateCcw className="size-3.5" aria-hidden />} onClick={() => void start()}>
            Retry upload
          </Button>
        ) : (
          <Button loading={uploading} disabled={file === undefined} onClick={() => void start()}>
            Upload document
          </Button>
        )}
      </div>
    </div>
  );
}
