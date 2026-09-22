import { useEffect, useId, useRef, useState } from "react";
import { FileUp, RotateCcw, X } from "lucide-react";
import { cn } from "../lib/cn";
import { Button } from "../ui/Button";
import { FormError } from "./FormError";

export type FileUploadState =
  | { readonly phase: "idle" }
  | {
      readonly phase: "uploading";
      readonly loaded?: number;
      readonly total?: number;
    }
  | { readonly phase: "failed"; readonly error: unknown }
  | { readonly phase: "cancelled" }
  | { readonly phase: "done"; readonly message?: React.ReactNode };

export interface FileRules {
  /** MIME types, as the platform accepts them. */
  readonly accept: readonly string[];
  /** The accepted types in words, e.g. "JPEG, PNG or PDF". */
  readonly acceptLabel: string;
  readonly maxBytes: number;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${String(Math.round(bytes / 1024))} KB`;

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** A courtesy check that saves a wasted upload; the platform checks the file again. */
export function checkFile(file: File, rules: FileRules): string | undefined {
  if (!rules.accept.includes(file.type))
    return `Upload a ${rules.acceptLabel} file.`;
  if (file.size === 0) return "That file is empty.";
  if (file.size > rules.maxBytes)
    return `The file must be ${formatFileSize(rules.maxBytes)} or smaller.`;

  return undefined;
}

export interface FileUploadProps extends FileRules {
  readonly file: File | undefined;
  readonly onFileChange: (file: File | undefined) => void;
  readonly state?: FileUploadState;
  readonly hint?: string;
  /** A message from the owner of the form, e.g. when submitting without a file. */
  readonly error?: string | undefined;
  readonly onCancel?: () => void;
  readonly onRetry?: () => void;
  readonly disabled?: boolean;
  readonly className?: string;
}

function percentOf(state: FileUploadState): number | undefined {
  if (
    state.phase !== "uploading" ||
    state.loaded === undefined ||
    state.total === undefined ||
    state.total <= 0
  )
    return undefined;

  return Math.min(100, Math.round((state.loaded / state.total) * 100));
}

export function FileUpload({
  accept,
  acceptLabel,
  maxBytes,
  file,
  onFileChange,
  state = { phase: "idle" },
  hint,
  error,
  onCancel,
  onRetry,
  disabled = false,
  className,
}: FileUploadProps): React.JSX.Element {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [problem, setProblem] = useState<string>();
  const uploading = state.phase === "uploading";
  const locked = disabled || uploading;
  const message = problem ?? error;
  const percent = percentOf(state);

  useEffect(() => {
    if (file === undefined && input.current !== null) input.current.value = "";
  }, [file]);

  const choose = (next: File | undefined): void => {
    if (next === undefined) {
      setProblem(undefined);
      onFileChange(undefined);

      return;
    }

    const found = checkFile(next, { accept, acceptLabel, maxBytes });

    setProblem(found);
    onFileChange(found === undefined ? next : undefined);
    if (found !== undefined && input.current !== null) input.current.value = "";
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!locked) setDragging(true);
        }}
        onDragLeave={() => {
          setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!locked) choose(event.dataTransfer.files[0]);
        }}
        className={cn(
          "flex flex-col items-center gap-2 rounded-md border border-dashed px-4 py-6 text-center transition-colors",
          dragging
            ? "border-brand bg-brand-subtle"
            : message !== undefined
              ? "border-danger bg-surface-sunken"
              : "border-border-strong bg-surface-sunken",
        )}
      >
        <FileUp className="size-5 text-text-muted" aria-hidden />
        <p className="type-body text-text-primary">
          {file === undefined ? "Drag a file here, or" : file.name}
        </p>
        {file !== undefined && (
          <p className="type-small text-text-muted">
            {formatFileSize(file.size)}
          </p>
        )}
        <label
          htmlFor={`${id}-file`}
          className={cn(
            "type-small cursor-pointer rounded-xs font-semibold text-brand hover:underline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand",
            locked && "pointer-events-none opacity-50",
          )}
        >
          {file === undefined ? "Choose a file" : "Choose a different file"}
          <input
            ref={input}
            id={`${id}-file`}
            type="file"
            accept={accept.join(",")}
            disabled={locked}
            aria-describedby={`${id}-hint${message === undefined ? "" : ` ${id}-error`}`}
            aria-invalid={message !== undefined}
            className="sr-only"
            onChange={(event) => {
              choose(event.target.files?.[0]);
            }}
          />
        </label>
        <p id={`${id}-hint`} className="type-small text-text-muted">
          {acceptLabel}, up to {formatFileSize(maxBytes)}.
          {hint === undefined ? "" : ` ${hint}`}
        </p>
        {message !== undefined && (
          <p
            id={`${id}-error`}
            role="alert"
            className="type-small font-medium text-danger"
          >
            {message}
          </p>
        )}
      </div>

      {state.phase === "uploading" && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="type-small text-text-secondary" aria-live="polite">
              {percent === undefined
                ? "Preparing upload…"
                : `Uploading… ${String(percent)}%`}
            </span>
            {onCancel !== undefined && (
              <Button
                variant="ghost"
                size="xs"
                leadingIcon={<X className="size-3" aria-hidden />}
                onClick={onCancel}
              >
                Cancel upload
              </Button>
            )}
          </div>
          <div
            role="progressbar"
            aria-label="Upload progress"
            aria-valuemin={0}
            aria-valuemax={100}
            {...(percent === undefined
              ? { "aria-valuetext": "Preparing upload" }
              : { "aria-valuenow": percent })}
            className="h-1.5 overflow-hidden rounded-full bg-surface-sunken"
          >
            <div
              className="h-full bg-brand transition-[width] duration-[var(--bn-duration-fast)]"
              style={{ width: `${String(percent ?? 0)}%` }}
            />
          </div>
        </div>
      )}
      {state.phase === "failed" && <FormError error={state.error} />}
      {state.phase === "cancelled" && (
        <p role="status" className="type-small text-text-secondary">
          Upload cancelled. Nothing was submitted.
        </p>
      )}
      {state.phase === "done" && state.message !== undefined && (
        <p role="status" className="type-small text-text-secondary">
          {state.message}
        </p>
      )}
      {(state.phase === "failed" || state.phase === "cancelled") &&
        file !== undefined &&
        onRetry !== undefined && (
          <div className="flex justify-end">
            <Button
              leadingIcon={<RotateCcw className="size-3.5" aria-hidden />}
              onClick={onRetry}
            >
              Retry upload
            </Button>
          </div>
        )}
    </div>
  );
}
