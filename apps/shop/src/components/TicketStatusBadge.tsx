import type { TicketStatus } from "@betng/contracts";
import { Badge } from "@betng/ui-web";
import { TICKET_STATUS } from "../lib/ticket";

export function TicketStatusBadge({ status, size = "sm", solid = false }: { readonly status: TicketStatus; readonly size?: "sm" | "md"; readonly solid?: boolean }): React.JSX.Element {
  const meta = TICKET_STATUS[status];

  return (
    <Badge tone={meta.tone} size={size} solid={solid}>
      {meta.label}
    </Badge>
  );
}
