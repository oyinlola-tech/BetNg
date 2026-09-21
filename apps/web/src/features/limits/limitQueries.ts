import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LimitKind, SelfExcludeRequest, SetLimitRequest } from "@betng/contracts";
import { useFlag } from "@betng/ui-web";
import { useSignedIn } from "../../hooks/accountQueries";
import { keys } from "../../lib/queryKeys";
import { accountServices } from "../../services/runtime";

export function useLimitsSummary() {
  const signedIn = useSignedIn();
  const enabled = useFlag("responsibleGamingEnabled");

  return useQuery({
    queryKey: keys.limitsSummary,
    queryFn: () => accountServices.limits.getSummary(),
    enabled: signedIn && enabled,
    staleTime: 30_000,
  });
}

export function useLimitHistory() {
  const signedIn = useSignedIn();
  const enabled = useFlag("responsibleGamingEnabled");

  return useQuery({
    queryKey: keys.limitHistory,
    queryFn: () => accountServices.limits.listHistory(),
    enabled: signedIn && enabled,
    staleTime: 30_000,
  });
}

function useLimitsMutation<TInput, TResult>(run: (input: TInput) => Promise<TResult>) {
  const client = useQueryClient();

  return useMutation({
    mutationFn: run,
    onSettled: () => {
      void client.invalidateQueries({ queryKey: keys.limitsRoot });
      void client.invalidateQueries({ queryKey: keys.wallet });
    },
  });
}

export function useSetLimit() {
  return useLimitsMutation((request: SetLimitRequest) => accountServices.limits.setLimit(request));
}

export function useRemoveLimit() {
  return useLimitsMutation((kind: LimitKind) => accountServices.limits.removeLimit(kind));
}

export function useSelfExclude() {
  return useLimitsMutation((request: SelfExcludeRequest) => accountServices.limits.selfExclude(request));
}

export function useCancelSelfExclusion() {
  return useLimitsMutation(() => accountServices.limits.cancelSelfExclusion());
}
