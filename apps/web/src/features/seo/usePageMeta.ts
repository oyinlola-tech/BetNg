import { useLocation } from "react-router";
import { useDocumentMeta } from "@betng/ui-web";
import { env } from "../../configs/env";

export interface PageMeta {
  readonly title: string;
  readonly description?: string;
  readonly noindex?: boolean;
  readonly path?: string;
}

export const SITE_NAME = "BETNG";
export const DEFAULT_DESCRIPTION =
  "Virtual football on BETNG: live matches, markets, results and standings. A simulated platform with play money only.";

function canonicalFor(path: string): string | undefined {
  if (env.siteUrl === undefined) return undefined;

  try {
    return new URL(path, env.siteUrl).toString();
  } catch {
    return undefined;
  }
}

export function usePageMeta(meta: PageMeta): void {
  const location = useLocation();
  const title = meta.title === SITE_NAME ? SITE_NAME : `${meta.title} · ${SITE_NAME}`;
  const description = meta.description ?? DEFAULT_DESCRIPTION;
  const canonical = meta.noindex === true ? undefined : canonicalFor(meta.path ?? location.pathname);

  useDocumentMeta({
    title,
    description,
    ...(canonical === undefined ? {} : { canonical }),
    ...(meta.noindex === true ? { noindex: true } : {}),
    og: { type: "website", siteName: SITE_NAME },
  });
}
