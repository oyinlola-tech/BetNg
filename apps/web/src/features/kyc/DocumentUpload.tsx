import { useEffect, useId, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { KYC_ACCEPTED_TYPES, KYC_MAX_BYTES, type KycDocumentType } from "@betng/contracts";
import { DataSourceError } from "@betng/ui-core";
import { Button, FileUpload, Select, checkFile, useToast, type FileRules, type FileUploadState } from "@betng/ui-web";
import { keys } from "../../lib/queryKeys";
import { accountServices, logger } from "../../services/runtime";
import { DOCUMENT_LABEL, DOCUMENT_TYPES } from "./kycMeta";

const RULES: FileRules = { accept: KYC_ACCEPTED_TYPES, acceptLabel: "JPEG, PNG or PDF", maxBytes: KYC_MAX_BYTES };

const RECEIVED = "Document received. It is now waiting for review; the status below updates when the platform reviews it.";

/** Client-side checks only save a wasted upload; the platform checks the file again. */
export function checkDocumentFile(file: File): string | undefined {
  return checkFile(file, RULES);
}

export function DocumentUpload(): React.JSX.Element {
  const id = useId();
  const client = useQueryClient();
  const { toast } = useToast();
  const [type, setType] = useState<KycDocumentType>("NATIONAL_ID");
  const [file, setFile] = useState<File>();
  const [missing, setMissing] = useState(false);
  const [upload, setUpload] = useState<FileUploadState>({ phase: "idle" });
  const controller = useRef<AbortController | undefined>(undefined);

  useEffect(() => () => controller.current?.abort(), []);

  const start = async (): Promise<void> => {
    if (file === undefined) {
      setMissing(true);

      return;
    }

    const abort = new AbortController();

    controller.current = abort;
    setUpload({ phase: "uploading" });

    try {
      await accountServices.kyc.uploadDocument({
        type,
        file,
        signal: abort.signal,
        onProgress: (progress) => {
          if (!abort.signal.aborted) setUpload({ phase: "uploading", loaded: progress.loaded, total: progress.total });
        },
      });

      setUpload({ phase: "done", message: RECEIVED });
      setFile(undefined);
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
  const retrying = (upload.phase === "failed" || upload.phase === "cancelled") && file !== undefined;

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor={`${id}-type`} className="mb-1.5 block text-sm font-medium text-text-secondary">
          Document type
        </label>
        <Select
          id={`${id}-type`}
          value={type}
          disabled={uploading}
          fullWidth
          onChange={setType}
          options={DOCUMENT_TYPES.map((value) => ({ value, label: DOCUMENT_LABEL[value] }))}
        />
      </div>

      <FileUpload
        {...RULES}
        file={file}
        onFileChange={(next) => {
          setFile(next);
          setMissing(false);
          setUpload({ phase: "idle" });
        }}
        state={upload}
        hint="Make sure every corner is visible and the text is readable."
        error={missing ? "Choose a file to upload." : undefined}
        onCancel={() => {
          controller.current?.abort();
        }}
        onRetry={() => void start()}
      />

      {!retrying && (
        <div className="flex justify-end gap-2">
          <Button loading={uploading} disabled={file === undefined} onClick={() => void start()}>
            Upload document
          </Button>
        </div>
      )}
    </div>
  );
}
