import type { KycUploadTicket } from "@betng/contracts";
import { DataSourceError } from "../dataSource.type.js";
import { isAllowedExternalUrl } from "../safety.js";
import type { UploadProgress } from "../accountServices.type.js";

export interface UploadOptions {
  readonly allowedHosts: readonly string[];
  readonly onProgress?: (progress: UploadProgress) => void;
  readonly signal?: AbortSignal;
}

/** Sends a file to a platform-issued upload target. XHR, not fetch, because only XHR reports upload progress. */
export function uploadToTicket(ticket: KycUploadTicket, file: Blob, options: UploadOptions): Promise<void> {
  if (!isAllowedExternalUrl(ticket.uploadUrl, options.allowedHosts)) {
    return Promise.reject(new DataSourceError("VALIDATION", "The upload destination is not trusted."));
  }

  if (Date.parse(ticket.expiresAt) <= Date.now()) {
    return Promise.reject(new DataSourceError("CONFLICT", "The upload slot expired. Try again."));
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = (): void => {
      xhr.abort();
    };

    xhr.open(ticket.method, ticket.uploadUrl);
    for (const [name, value] of Object.entries(ticket.headers)) xhr.setRequestHeader(name, value);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) options.onProgress?.({ loaded: event.loaded, total: event.total });
    };
    xhr.onload = () => {
      options.signal?.removeEventListener("abort", abort);
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new DataSourceError(xhr.status === 413 ? "VALIDATION" : "UNAVAILABLE", xhr.status === 413 ? "The file is too large." : "The upload did not complete.", { status: xhr.status }));
    };
    xhr.onerror = () => {
      options.signal?.removeEventListener("abort", abort);
      reject(new DataSourceError("NETWORK", "The upload was interrupted."));
    };
    xhr.onabort = () => {
      reject(new DataSourceError("CONFLICT", "The upload was cancelled."));
    };

    if (options.signal?.aborted === true) {
      reject(new DataSourceError("CONFLICT", "The upload was cancelled."));
      return;
    }

    options.signal?.addEventListener("abort", abort, { once: true });
    xhr.send(file);
  });
}
