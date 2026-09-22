import { lazy, Suspense } from "react";
import { Navigate, type RouteObject } from "react-router";
import { PageSkeleton } from "@betng/ui-web";
import type { LegalSlug } from "../pages/legal/content";

const LegalPage = lazy(() => import("../pages/legal/LegalPage").then((m) => ({ default: m.LegalPage })));

const SLUGS: readonly LegalSlug[] = ["terms", "privacy", "responsible-gaming", "aml-kyc", "cookies", "complaints"];

/** Terms, privacy, responsible gaming, AML/KYC, cookies and complaints. Public. */
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
