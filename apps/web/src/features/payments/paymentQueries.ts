import { useCallback, useEffect, useRef } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PaymentDirection, PaymentHistoryQuery, PaymentRecord } from "@betng/contracts";
import { DataSourceError } from "@betng/ui-core";
import { useFlag } from "@betng/ui-web";
import { useSignedIn } from "../../hooks/accountQueries";
import { keys } from "../../lib/queryKeys";
import { accountServices } from "../../services/runtime";
import { isTerminalPayment, pollDelay, POLL_DELAYS_MS } from "./paymentMeta";

/** Wallet and payment reads that change whenever a payment moves. */
export function useRefreshMoney(): () => void {
  const client = useQueryClient();

  return useCallback(() => {
    void client.invalidateQueries({ queryKey: keys.wallet });
    void client.invalidateQueries({ queryKey: keys.transactionsRoot });
    void client.invalidateQueries({ queryKey: keys.paymentsRoot, predicate: (query) => query.queryKey[1] !== "record" });
  }, [client]);
}

export function usePaymentHistory(query: PaymentHistoryQuery, enabled = true) {
  const signedIn = useSignedIn();
  const payments = useFlag("paymentsEnabled");

  return useQuery({
    queryKey: keys.paymentHistory(query),
    queryFn: () => accountServices.payments.listHistory(query),
    enabled: signedIn && payments && enabled,
    staleTime: 15_000,
    placeholderData: keepPreviousData,
  });
}

export function useBankAccounts() {
  const signedIn = useSignedIn();
  const payments = useFlag("paymentsEnabled");

  return useQuery({
    queryKey: keys.bankAccounts,
    queryFn: () => accountServices.payments.listBankAccounts(),
    enabled: signedIn && payments,
    staleTime: 60_000,
  });
}

export function useBanks(enabled: boolean) {
  return useQuery({
    queryKey: keys.banks,
    queryFn: () => accountServices.payments.listBanks(),
    enabled,
    staleTime: 60 * 60_000,
  });
}

export function useSetDefaultBankAccount() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => accountServices.payments.setDefaultBankAccount(id),
    onSettled: () => client.invalidateQueries({ queryKey: keys.bankAccounts }),
  });
}

export function useDeleteBankAccount() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => accountServices.payments.deleteBankAccount(id),
    onSettled: () => client.invalidateQueries({ queryKey: keys.bankAccounts }),
  });
}

export interface PaymentStatusOptions {
  readonly pollDelaysMs?: readonly number[];
  readonly enabled?: boolean;
}

/**
 * Asks the platform for a payment's state, backing off while it stays open
 * and stopping at a terminal status. Every change re-reads the wallet.
 */
export function usePaymentStatus(reference: string | undefined, direction: PaymentDirection, options: PaymentStatusOptions = {}) {
  const signedIn = useSignedIn();
  const delays = options.pollDelaysMs ?? POLL_DELAYS_MS;
  const refresh = useRefreshMoney();

  const query = useQuery<PaymentRecord>({
    queryKey: keys.payment(direction, reference ?? ""),
    queryFn: () => (direction === "WITHDRAWAL" ? accountServices.payments.getWithdrawal(reference ?? "") : accountServices.payments.verifyDeposit(reference ?? "")),
    enabled: signedIn && reference !== undefined && options.enabled !== false,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: (current) => {
      const { data, error, dataUpdateCount, errorUpdateCount } = current.state;

      if (data !== undefined && isTerminalPayment(data.status)) return false;
      if (error instanceof DataSourceError) {
        if (error.code === "RATE_LIMITED") return Math.max(1, error.detail.retryAfterSeconds ?? 30) * 1000;
        if (!["NETWORK", "TIMEOUT", "UNAVAILABLE", "SERVER", "OFFLINE"].includes(error.code)) return false;
      }

      return pollDelay(dataUpdateCount + errorUpdateCount - 1, delays);
    },
  });

  const lastStatus = useRef<string | undefined>(undefined);
  const status = query.data?.status;

  useEffect(() => {
    if (status === undefined || status === lastStatus.current) return;

    lastStatus.current = status;
    refresh();
  }, [status, refresh]);

  return query;
}
