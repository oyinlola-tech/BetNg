import { ErrorState, LoadingState } from "@betng/ui-web";
import { Guard } from "../components/Guard";
import { PageHeader } from "../components/PageHeader";
import { CurrentShiftPanel } from "../features/shifts/CurrentShiftPanel";
import { ShiftUnavailable } from "../features/shifts/ShiftUnavailable";
import { StartShiftForm } from "../features/shifts/StartShiftForm";
import { isNotImplemented, useShiftsEnabled } from "../features/shifts/useShiftsAvailable";
import { useCurrentShift } from "../hooks/queries";

function Shift(): React.JSX.Element {
  const enabled = useShiftsEnabled();
  const current = useCurrentShift(enabled);

  if (!enabled || isNotImplemented(current.error)) return <ShiftUnavailable />;
  if (current.isPending) return <LoadingState label="Loading your shift" />;
  if (current.isError) return <ErrorState error={current.error} onRetry={() => void current.refetch()} />;

  return current.data === null ? <StartShiftForm /> : <CurrentShiftPanel shift={current.data} />;
}

export function ShiftPage(): React.JSX.Element {
  return (
    <Guard permission="shifts:operate">
      <div className="mx-auto max-w-5xl p-4 lg:p-6">
        <PageHeader title="Shift" description="Your cash drawer for this session: opening float, cash movements and the close." />
        <Shift />
      </div>
    </Guard>
  );
}
