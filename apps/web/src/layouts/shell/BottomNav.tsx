import { NavLink } from "react-router";
import { Ellipsis, Home, Radio, Receipt } from "lucide-react";
import { Football, cn, useFeatureFlags } from "@betng/ui-web";
import { useBetSlipCount } from "../../features/betslip";
import { paths } from "../../lib/paths";

const ITEM = "relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium focus-ring";

function itemClass({ isActive }: { readonly isActive: boolean }): string {
  return cn(ITEM, isActive ? "text-brand" : "text-text-secondary");
}

export function BottomNav({ onMore, moreOpen }: { readonly onMore: () => void; readonly moreOpen: boolean }): React.JSX.Element {
  const flags = useFeatureFlags();
  const slipCount = useBetSlipCount();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-sticky border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <div className="mx-auto flex max-w-xl">
        <NavLink to={paths.home} end className={itemClass}>
          <Home className="size-5" aria-hidden />
          Home
        </NavLink>
        <NavLink to={paths.football} className={itemClass}>
          <Football size={20} aria-hidden />
          Football
        </NavLink>
        {flags.liveEnabled && (
          <NavLink to={paths.live} className={itemClass}>
            <Radio className="size-5" aria-hidden />
            Live
          </NavLink>
        )}
        <NavLink to={paths.tickets} className={itemClass} aria-label={slipCount > 0 ? `Bets, ${String(slipCount)} on the slip` : "Bets"}>
          <Receipt className="size-5" aria-hidden />
          Bets
        </NavLink>
        <button type="button" onClick={onMore} aria-haspopup="dialog" aria-expanded={moreOpen} className={cn(ITEM, moreOpen ? "text-brand" : "text-text-secondary")}>
          <Ellipsis className="size-5" aria-hidden />
          More
        </button>
      </div>
    </nav>
  );
}
