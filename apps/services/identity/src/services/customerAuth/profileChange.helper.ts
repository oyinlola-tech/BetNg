import type { Customer } from "../../generated/prisma/client.js";
import type { CustomerProfileChanges } from "../../interfaces/index.js";
import { maskPhone, normalisePhone } from "../../utils/index.js";

export interface ProfileChange {
  readonly changes: CustomerProfileChanges;
  readonly before: Readonly<Record<string, string | null>>;
  readonly after: Readonly<Record<string, string | null>>;
}

const shownPhone = (phone: string | null): string | null => (phone === null ? null : maskPhone(phone));

/** Only fields that actually change. The audit trail keeps the phone masked; the row keeps it normalised. */
export function profileChange(customer: Customer, request: { readonly displayName?: string | undefined; readonly phone?: string | undefined }): ProfileChange | undefined {
  const displayName = request.displayName?.trim();
  const phone = request.phone === undefined ? undefined : normalisePhone(request.phone);
  const changes: { displayName?: string; phone?: string } = {};
  const before: Record<string, string | null> = {};
  const after: Record<string, string | null> = {};

  if (displayName !== undefined && displayName !== customer.displayName) {
    changes.displayName = displayName;
    before["displayName"] = customer.displayName;
    after["displayName"] = displayName;
  }

  if (phone !== undefined && phone !== (customer.phone === null ? null : normalisePhone(customer.phone))) {
    changes.phone = phone;
    before["phone"] = shownPhone(customer.phone);
    after["phone"] = shownPhone(phone);
  }

  return Object.keys(changes).length === 0 ? undefined : { changes, before, after };
}
