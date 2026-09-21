import type { StatementJob } from "@betng/contracts";
import { isAllowedExternalUrl } from "@betng/ui-core";
import type { StatusTone } from "@betng/ui-web";

export const STATEMENT_STATUS: Readonly<Record<StatementJob["status"], { readonly label: string; readonly tone: StatusTone }>> = {
  QUEUED: { label: "Preparing", tone: "pending" },
  READY: { label: "Ready", tone: "success" },
  FAILED: { label: "Failed", tone: "danger" },
  EXPIRED: { label: "Expired", tone: "neutral" },
};

const JOB_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function validJobId(value: string | null): string | undefined {
  return value !== null && JOB_ID.test(value) ? value : undefined;
}

/**
 * The platform's signed link, accepted only when it points back at the API's
 * own origin or at an allowlisted https host. The page never builds a statement itself.
 */
export function safeDownloadUrl(candidate: string | undefined, apiUrl: string, allowedHosts: readonly string[]): string | undefined {
  if (candidate === undefined) return undefined;

  let url: URL;
  let api: URL;

  try {
    url = new URL(candidate);
    api = new URL(apiUrl);
  } catch {
    return undefined;
  }

  if (url.username !== "" || url.password !== "") return undefined;
  if (url.origin === api.origin && (url.protocol === "https:" || url.protocol === "http:")) return url.href;

  return isAllowedExternalUrl(candidate, allowedHosts) ? url.href : undefined;
}
