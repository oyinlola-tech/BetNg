import { useEffect } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  NotificationPreferences,
  NotificationView,
  TransactionQuery,
} from "@betng/ui-core";
import { useSession } from "@betng/ui-web";
import { keys } from "../lib/queryKeys";
import { dataSource, session } from "../services/runtime";

export const RECENT_TRANSACTIONS_QUERY: TransactionQuery = Object.freeze({
  page: 1,
  pageSize: 8,
  sort: "createdAt",
  direction: "desc",
});

export function useSignedIn(): boolean {
  return useSession(session).status === "AUTHENTICATED";
}

export function useWallet() {
  const enabled = useSignedIn();

  return useQuery({
    queryKey: keys.wallet,
    queryFn: () => dataSource.getWallet(),
    enabled,
    staleTime: 15_000,
  });
}

export function useTransactionsPage(query: TransactionQuery) {
  const enabled = useSignedIn();

  return useQuery({
    queryKey: keys.transactions(query),
    queryFn: () => dataSource.queryTransactions(query),
    enabled,
    staleTime: 15_000,
    placeholderData: keepPreviousData,
  });
}

export function useBets() {
  const enabled = useSignedIn();

  return useQuery({
    queryKey: keys.bets,
    queryFn: () => dataSource.listBets(),
    enabled,
    staleTime: 10_000,
    placeholderData: keepPreviousData,
  });
}

export function useBet(betId: string | undefined) {
  const enabled = useSignedIn();

  return useQuery({
    queryKey: keys.bet(betId ?? ""),
    queryFn: () => dataSource.getBet(betId ?? ""),
    enabled: enabled && betId !== undefined,
    staleTime: 10_000,
  });
}

export function useNotifications() {
  const enabled = useSignedIn();

  return useQuery({
    queryKey: keys.notifications,
    queryFn: () => dataSource.listNotifications(),
    enabled,
    staleTime: 10_000,
    placeholderData: keepPreviousData,
  });
}

export function useMarkNotificationsRead() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (ids?: readonly string[]) =>
      dataSource.markNotificationsRead(ids),
    onMutate: async (ids?: readonly string[]) => {
      await client.cancelQueries({ queryKey: keys.notifications });

      const previous = client.getQueryData<readonly NotificationView[]>(keys.notifications);

      if (previous !== undefined) {
        const targets = ids === undefined ? undefined : new Set(ids);

        client.setQueryData<readonly NotificationView[]>(
          keys.notifications,
          previous.map((item) => (item.read || (targets !== undefined && !targets.has(item.id)) ? item : { ...item, read: true })),
        );
      }

      return { previous };
    },
    onError: (_error, _ids, context) => {
      if (context?.previous !== undefined) client.setQueryData(keys.notifications, context.previous);
    },
    onSettled: () => client.invalidateQueries({ queryKey: keys.notifications }),
  });
}

export function useNotificationPreferences() {
  const enabled = useSignedIn();

  return useQuery({
    queryKey: keys.preferences,
    queryFn: () => dataSource.getNotificationPreferences(),
    enabled,
    staleTime: 60_000,
  });
}

export function useSetNotificationPreferences() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (preferences: NotificationPreferences) =>
      dataSource.setNotificationPreferences(preferences),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.preferences }),
  });
}

function useWalletMutation(run: (amount: number) => Promise<unknown>) {
  const client = useQueryClient();

  return useMutation({
    mutationFn: run,
    retry: false,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.wallet });
      void client.invalidateQueries({ queryKey: keys.transactionsRoot });
    },
  });
}

export function useDeposit() {
  return useWalletMutation((amount) => dataSource.deposit(amount));
}

export function useWithdraw() {
  return useWalletMutation((amount) => dataSource.withdraw(amount));
}

/** Re-reads the customer's data when the platform reports an account change (settlement, payout, payment, limit, new alert). */
export function useAccountSignals(): void {
  const client = useQueryClient();
  const signedIn = useSignedIn();

  useEffect(() => {
    if (!signedIn) return;

    return dataSource.subscribeAccount(() => {
      void client.invalidateQueries({ queryKey: keys.wallet });
      void client.invalidateQueries({ queryKey: keys.bets });
      void client.invalidateQueries({ queryKey: keys.transactionsRoot });
      void client.invalidateQueries({ queryKey: keys.notifications });
      void client.invalidateQueries({ queryKey: keys.paymentsRoot });
      void client.invalidateQueries({ queryKey: keys.limitsRoot });
    });
  }, [client, signedIn]);
}
