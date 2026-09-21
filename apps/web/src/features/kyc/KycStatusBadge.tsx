import type { KycStatus } from "@betng/contracts";
import { StatusBadge } from "@betng/ui-web";
import { KYC_STATUS } from "./kycMeta";

export function KycStatusBadge({ status, className }: { readonly status: KycStatus; readonly className?: string }): React.JSX.Element {
  const meta = KYC_STATUS[status];

  return (
    <StatusBadge tone={meta.tone} icon={meta.icon} {...(className === undefined ? {} : { className })}>
      {meta.label}
    </StatusBadge>
  );
}
