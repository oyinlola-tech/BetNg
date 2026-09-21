import { UnauthorizedState } from "@betng/ui-web";
import { useAuth } from "../features/auth";
import { usePageMeta } from "../features/seo";

export function UnauthorizedPage(): React.JSX.Element {
  const { requireAuth } = useAuth();

  usePageMeta({ title: "Sign in required", noindex: true });

  return (
    <section aria-labelledby="unauthorized-title" className="mx-auto max-w-lg rounded-md border border-border bg-surface">
      <h1 id="unauthorized-title" className="sr-only">
        Sign in required
      </h1>
      <UnauthorizedState
        description="This page belongs to an account. Sign in to open it."
        onSignIn={() => {
          requireAuth({ reason: "Sign in to continue" });
        }}
      />
    </section>
  );
}
