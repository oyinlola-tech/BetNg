import { Timer } from "lucide-react";
import { EmptyState, Panel } from "@betng/ui-web";

export function ShiftUnavailable(): React.JSX.Element {
  return (
    <Panel className="mx-auto mt-6 max-w-lg">
      <EmptyState
        icon={<Timer className="size-5" />}
        title="Not available yet"
        description="Cash shifts are not switched on for this shop yet. Selling, checking and paying tickets work as before."
      />
    </Panel>
  );
}
