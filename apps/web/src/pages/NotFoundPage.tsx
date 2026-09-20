import { Link } from "react-router";
import { EmptyState } from "../components/ui";

export function NotFoundPage(): React.JSX.Element {
  return (
    <EmptyState
      title="Page not found"
      description="That page does not exist or has moved."
      action={
        <Link
          to="/"
          className="text-sm font-semibold text-brand hover:underline"
        >
          Back to home
        </Link>
      }
    />
  );
}
