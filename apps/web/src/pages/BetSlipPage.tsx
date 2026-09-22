import { useEffect } from "react";
import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import { BetSlipPanel } from "../features/betslip";
import { usePageMeta } from "../features/seo";
import { analytics } from "../services/analytics";

export function BetSlipPage(): React.JSX.Element {
  usePageMeta({ title: "Bet slip", noindex: true });

  useEffect(() => {
    analytics.track("bet_slip_opened", { surface: "page" });
  }, []);

  return (
    <div className="mx-auto w-full max-w-xl space-y-4">
      <Link to="/" className="type-small inline-flex items-center gap-1.5 rounded-xs font-semibold text-text-secondary hover:text-text-primary focus-ring">
        <ArrowLeft className="size-3.5" aria-hidden />
        Keep browsing
      </Link>
      <h1 className="sr-only">Bet slip</h1>
      <BetSlipPanel variant="card" />
    </div>
  );
}
