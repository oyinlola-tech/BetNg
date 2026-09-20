import { useNavigate } from "react-router";
import { Compass } from "lucide-react";
import { Button, EmptyState } from "@betng/ui-web";

export function NotFoundPage(): React.JSX.Element {
  const navigate = useNavigate();

  return (
    <EmptyState
      icon={<Compass className="size-5" />}
      title="That screen does not exist"
      description="The address may be mistyped, or the screen was moved."
      action={
        <Button variant="secondary" onClick={() => void navigate("/")}>
          Back to dashboard
        </Button>
      }
    />
  );
}
