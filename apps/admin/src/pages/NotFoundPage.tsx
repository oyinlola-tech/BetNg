import { Link } from "react-router";
import { NotFoundState } from "@betng/ui-web";

export function NotFoundPage(): React.JSX.Element {
  return (
    <>
      <h1 className="sr-only">Page not found</h1>
      <NotFoundState
        title="No such screen"
        description="The address does not match anything in the console."
        action={
          <Link to="/" className="inline-flex h-8 items-center rounded-sm border border-border-strong bg-surface px-3 text-sm font-semibold text-text-primary hover:bg-surface-hover focus-ring">
            Back to the dashboard
          </Link>
        }
      />
    </>
  );
}
