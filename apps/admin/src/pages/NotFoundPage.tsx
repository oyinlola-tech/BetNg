import { Link } from "react-router";
import { Compass } from "lucide-react";
import { Button, EmptyState } from "@betng/ui-web";

export function NotFoundPage(): React.JSX.Element {
  return (
    <EmptyState
      icon={<Compass className="size-5" />}
      title="No such screen"
      description="The address does not match anything in the console."
      action={
        <Link to="/">
          <Button variant="secondary" size="sm">
            Back to the dashboard
          </Button>
        </Link>
      }
    />
  );
}
