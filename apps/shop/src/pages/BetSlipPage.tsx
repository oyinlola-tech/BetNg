import { PageHeader } from "../components/PageHeader";
import { SlipPanel } from "../components/SlipPanel";

/** The slip on its own page, for narrow terminals and for reviewing a long ticket. */
export function BetSlipPage(): React.JSX.Element {
  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col p-4 md:p-6">
      <PageHeader title="Bet Slip" description="Review the selections, set the stake and issue the ticket." />
      <SlipPanel className="mt-4 min-h-0 flex-1 rounded-md border border-border" />
    </div>
  );
}
