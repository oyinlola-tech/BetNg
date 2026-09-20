import type { TicketStatus } from "@betng/contracts";
import { Badge } from "@betng/ui-web";
import { TICKET_STATUS } from "../lib/ticket";

const BADGE_TONE = { success: "success", danger: "danger", warning: "warning", brand: "brand", live: "live", neutral: "neutral" } as const;

export function TicketStatusBadge({ status, size = "sm", solid = false }: { readonly status: TicketStatus; readonly size?: "sm" | "md"; readonly solid?: boolean }): React.JSX.Element {
  const meta = TICKET_STATUS[status];

  return (
    <Badge tone={BADGE_TONE[meta.tone]} size={size} solid={solid}>
      {meta.label}
    </Badge>
  );
}
