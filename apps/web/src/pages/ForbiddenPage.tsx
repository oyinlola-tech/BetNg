import { ForbiddenState } from "@betng/ui-web";
import { usePageMeta } from "../features/seo";

export function ForbiddenPage(): React.JSX.Element {
  usePageMeta({ title: "Not allowed", noindex: true });

  return (
    <section aria-labelledby="forbidden-title" className="mx-auto max-w-lg rounded-md border border-border bg-surface">
      <h1 id="forbidden-title" className="sr-only">
        Not allowed
      </h1>
      <ForbiddenState />
    </section>
  );
}
