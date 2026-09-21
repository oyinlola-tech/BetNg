import { keepPreviousData, useQuery, type UseQueryResult } from "@tanstack/react-query";
import { kycStatusSchema, paymentDirectionSchema, paymentProviderSchema, paymentStatusSchema, responsibleGamingAccountSchema, type AdminPayment, type KycReviewItem, type Page, type ResponsibleGamingAccount } from "@betng/contracts";
import { localDayRange } from "@betng/ui-core";
import { keys } from "../lib/queryKeys";
import { compliance } from "../services/runtime";
import { useListParams, type PagedList } from "./useAdminList";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const REFRESH_MS = 30_000;
export const RG_FLAGS = responsibleGamingAccountSchema.shape.flags.element.options;

/* A hand-edited address must not turn into a request the platform would refuse. */
function oneOf<T extends string>(value: string | undefined, options: readonly T[]): T | undefined {
  return options.find((option) => option === value);
}

function base(request: { readonly page: number; readonly pageSize: number; readonly search?: string }) {
  return { page: request.page, pageSize: request.pageSize, ...(request.search === undefined ? {} : { search: request.search }) };
}

export function useKycQueue(): PagedList<KycReviewItem> {
  const params = useListParams({ filterKeys: ["status"], defaults: { pageSize: 25 } });
  const { request } = params;
  const status = oneOf(request.filters["status"], kycStatusSchema.options);
  const query = useQuery({
    queryKey: keys.compliance("kyc", request),
    queryFn: () => compliance.listKycQueue({ ...base(request), ...(status === undefined ? {} : { status }) }),
    placeholderData: keepPreviousData,
    refetchInterval: REFRESH_MS,
  }) as UseQueryResult<Page<KycReviewItem>>;

  return { ...params, query };
}

export const PAYMENT_FILTERS = ["direction", "status", "provider", "from", "to"] as const;

export function usePayments(): PagedList<AdminPayment> {
  const params = useListParams({ filterKeys: PAYMENT_FILTERS, defaults: { pageSize: 25 } });
  const { request } = params;
  const f = request.filters;
  const direction = oneOf(f["direction"], paymentDirectionSchema.options);
  const status = oneOf(f["status"], paymentStatusSchema.options);
  const provider = oneOf(f["provider"], paymentProviderSchema.options);
  const from = f["from"] !== undefined && DAY.test(f["from"]) ? localDayRange(f["from"]).from : undefined;
  const to = f["to"] !== undefined && DAY.test(f["to"]) ? localDayRange(f["to"]).to : undefined;
  const query = useQuery({
    queryKey: keys.compliance("payments", request),
    queryFn: () =>
      compliance.listPayments({
        ...base(request),
        ...(direction === undefined ? {} : { direction }),
        ...(status === undefined ? {} : { status }),
        ...(provider === undefined ? {} : { provider }),
        ...(from === undefined ? {} : { from }),
        ...(to === undefined ? {} : { to }),
      }),
    placeholderData: keepPreviousData,
    refetchInterval: REFRESH_MS,
  }) as UseQueryResult<Page<AdminPayment>>;

  return { ...params, query };
}

export const usePaymentOverview = () => useQuery({ queryKey: keys.compliance("payments-overview"), queryFn: () => compliance.getPaymentOverview(), refetchInterval: REFRESH_MS, placeholderData: keepPreviousData });

export function useResponsibleGaming(): PagedList<ResponsibleGamingAccount> {
  const params = useListParams({ filterKeys: ["flag"], defaults: { pageSize: 25 } });
  const { request } = params;
  const flag = oneOf(request.filters["flag"], RG_FLAGS);
  const query = useQuery({
    queryKey: keys.compliance("responsible-gaming", request),
    queryFn: () => compliance.listResponsibleGaming({ ...base(request), ...(flag === undefined ? {} : { flag }) }),
    placeholderData: keepPreviousData,
  }) as UseQueryResult<Page<ResponsibleGamingAccount>>;

  return { ...params, query };
}
