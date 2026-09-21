import { displayClock, type MatchClockView } from "@betng/ui-core";
import { useNow } from "@betng/ui-web";

/** The platform's clock, advanced between reports only when it supplied a minute length. */
export function LiveMinute({ clock }: { readonly clock: MatchClockView | undefined }): React.JSX.Element {
  const now = useNow(1000);

  return <span className="tabular">{displayClock(clock, now)?.label ?? "LIVE"}</span>;
}
