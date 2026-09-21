import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@betng/ui-web";
import { keys } from "../lib/queryKeys";
import { dataSource, session } from "../services/runtime";

function useSignedIn(): boolean {
  return useSession(session).status === "AUTHENTICATED";
}

export function useWalletSummary(enabled: boolean) {
  const signedIn = useSignedIn();

  return useQuery({
    queryKey: keys.wallet,
    queryFn: () => dataSource.getWallet(),
    enabled: signedIn && enabled,
  });
}

export function useUnreadNotifications(): number {
  const signedIn = useSignedIn();
  const { data } = useQuery({
    queryKey: keys.notifications,
    queryFn: () => dataSource.listNotifications(),
    enabled: signedIn,
    staleTime: 30_000,
  });

  return data?.filter((notification) => !notification.read).length ?? 0;
}

/** Account data is re-read when the platform signals a change; nothing is patched from the signal. */
export function useAccountSync(): void {
  const client = useQueryClient();
  const signedIn = useSignedIn();

  useEffect(() => {
    if (!signedIn) return;

    return dataSource.subscribeAccount(() => {
      void client.invalidateQueries({ queryKey: keys.wallet });
      void client.invalidateQueries({ queryKey: keys.bets });
      void client.invalidateQueries({ queryKey: keys.transactionsRoot });
      void client.invalidateQueries({ queryKey: keys.notifications });
    });
  }, [client, signedIn]);
}
