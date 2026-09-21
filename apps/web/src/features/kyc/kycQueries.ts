import { useQuery } from "@tanstack/react-query";
import { useFlag } from "@betng/ui-web";
import { useSignedIn } from "../../hooks/accountQueries";
import { keys } from "../../lib/queryKeys";
import { accountServices } from "../../services/runtime";

export function useKycOverview() {
  const signedIn = useSignedIn();
  const enabled = useFlag("kycEnabled");

  return useQuery({
    queryKey: keys.kycOverview,
    queryFn: () => accountServices.kyc.getOverview(),
    enabled: signedIn && enabled,
    staleTime: 30_000,
    refetchInterval: (query) => (query.state.data?.status === "PENDING" ? 15_000 : false),
  });
}

export function useKycDocuments() {
  const signedIn = useSignedIn();
  const enabled = useFlag("kycEnabled");

  return useQuery({
    queryKey: keys.kycDocuments,
    queryFn: () => accountServices.kyc.listDocuments(),
    enabled: signedIn && enabled,
    staleTime: 30_000,
    refetchInterval: (query) => (query.state.data?.some((doc) => doc.status === "PENDING") === true ? 15_000 : false),
  });
}
