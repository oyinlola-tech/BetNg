import { useState } from "react";
import { Link } from "react-router";
import type { CashierShift } from "@betng/contracts";
import { EmptyState, ErrorState, LoadingState, Panel } from "@betng/ui-web";
import { Guard } from "../components/Guard";
import { PageHeader } from "../components/PageHeader";
import { CloseShiftForm } from "../features/shifts/CloseShiftForm";
import { ShiftResult } from "../features/shifts/ShiftResult";
import { ShiftUnavailable } from "../features/shifts/ShiftUnavailable";
import { isNotImplemented, useShiftsEnabled } from "../features/shifts/useShiftsAvailable";
import { useCurrentShift } from "../hooks/queries";

const LINK = "inline-flex h-10 items-center rounded-sm border border-border-strong bg-surface px-4 text-base font-medium text-text-primary hover:bg-surface-hover focus-ring";

function CloseShift(): React.JSX.Element {
  const enabled = useShiftsEnabled();
  const [closed, setClosed] = useState<CashierShift | undefined>();
  const current = useCurrentShift(enabled && closed === undefined);

  if (!enabled || isNotImplemented(current.error)) return <ShiftUnavailable />;
  if (closed !== undefined)
    return (
      <ShiftResult shift={closed}>
        <Link to="/cashier/shift" className={LINK}>
          Back to shift
        </Link>
      </ShiftResult>
    );
  if (current.isPending) return <LoadingState label="Loading your shift" />;
  if (current.isError) return <ErrorState error={current.error} onRetry={() => void current.refetch()} />;
  if (current.data === null)
    return (
      <Panel className="max-w-lg">
        <EmptyState title="No shift is open" description="Start a shift before closing one." action={<Link to="/cashier/shift" className={LINK}>Go to shift</Link>} />
      </Panel>
    );

  return <CloseShiftForm shift={current.data} onClosed={setClosed} />;
}

export function ShiftClosePage(): React.JSX.Element {
  return (
    <Guard permission="shifts:operate">
      <div className="mx-auto max-w-5xl p-4 lg:p-6">
        <PageHeader title="Close shift" description="Count the drawer and confirm with your PIN. The shift cannot be reopened." />
        <CloseShift />
      </div>
    </Guard>
  );
}
