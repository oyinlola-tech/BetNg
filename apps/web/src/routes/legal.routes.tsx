import { lazy, Suspense } from "react";
import { Navigate, type RouteObject } from "react-router";
import { PageSkeleton } from "@betng/ui-web";
import type { LegalSlug } from "../pages/legal/content";

const LegalPage = lazy(() => import("../pages/legal/LegalPage").then((m) => ({ default: m.LegalPage })));

const SLUGS: readonly LegalSlug[] = [
  "terms",
  "betting-rules",
  "privacy",
  "responsible-gaming",
  "self-exclusion",
  "age-policy",
  "aml-kyc",
  "payments",
  "account-closure",
  "cookies",
  "complaints",
];

/** The public legal documents. Each renders from configurable content and is noindexed until its text is approved. */
export const legalRoutes: RouteObject[] = [
  { path: "legal", element: <Navigate to="/legal/terms" replace /> },
  ...SLUGS.map((slug) => ({
    path: `legal/${slug}`,
    element: (
      <Suspense fallback={<PageSkeleton cards={2} />}>
        <LegalPage slug={slug} />
      </Suspense>
    ),
  })),
];
