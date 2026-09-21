import { Link } from "react-router";
import { NotFoundState } from "@betng/ui-web";
import { usePageMeta } from "../features/seo";
import { paths } from "../lib/paths";

const ACTION = "inline-flex h-10 items-center rounded-sm border border-border-strong bg-surface px-4 text-base font-semibold text-text-primary hover:bg-surface-hover focus-ring";

export function NotFoundPage(): React.JSX.Element {
  usePageMeta({ title: "Page not found", noindex: true });

  return (
    <section aria-labelledby="not-found-title" className="mx-auto max-w-lg rounded-md border border-border bg-surface">
      <h1 id="not-found-title" className="sr-only">
        Page not found
      </h1>
      <NotFoundState
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Link to={paths.home} className={ACTION}>
              Go home
            </Link>
            <Link to={paths.virtuals} className={ACTION}>
              See fixtures
            </Link>
          </div>
        }
      />
    </section>
  );
}
