import { Lock } from "lucide-react";
import type { MarketView } from "@betng/ui-core";
import { ToneTag } from "../domain/ToneTag";
import { MARKET_STATUS_TONE, MARKET_STATUS_WORD } from "./marketStatus";

export interface MarketStatusTagProps {
  readonly status: MarketView["status"];
  readonly className?: string | undefined;
}

export function MarketStatusTag({
  status,
  className,
}: MarketStatusTagProps): React.JSX.Element {
  return (
    <ToneTag
      tone={MARKET_STATUS_TONE[status]}
      icon={
        status === "OPEN" ? undefined : <Lock className="size-3" aria-hidden />
      }
      className={className}
    >
      {MARKET_STATUS_WORD[status]}
    </ToneTag>
  );
}
