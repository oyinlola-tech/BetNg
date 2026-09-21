import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import type { AuditLogQuery, LeagueId } from "@betng/contracts";
import { presentError, useToast } from "@betng/ui-web";
import type { AdminFixtureQuery } from "@betng/client-sdk";
import { keys } from "../lib/queryKeys";
import { adminSource, dataSource } from "../services/sources";

const SEASON_MS = 8000;
const keep = <T,>(previous: T | undefined): T | undefined => previous;

export function useAdminSync(): void {
  const client = useQueryClient();

  useEffect(
    () =>
      adminSource.subscribe(() => {
        void client.invalidateQueries({ queryKey: keys.root, refetchType: "active" });
      }),
    [client],
  );
}

export const useOverview = (enabled = true) => useQuery({ queryKey: keys.overview, queryFn: () => adminSource.getOverview(), refetchInterval: SEASON_MS, enabled, placeholderData: keep });
export const useServiceHealth = (enabled = true) => useQuery({ queryKey: keys.health, queryFn: () => adminSource.listServiceHealth(), refetchInterval: 5000, enabled, placeholderData: keep });
export const useCustomers = (q: string) => useQuery({ queryKey: keys.customers(q), queryFn: () => adminSource.listCustomers(q), placeholderData: keep });
export const useShops = (enabled = true) => useQuery({ queryKey: keys.shops, queryFn: () => adminSource.listShops(), enabled, placeholderData: keep });
export const useShop = (shopId: string | undefined) => useQuery({ queryKey: keys.shop(shopId ?? ""), queryFn: () => adminSource.getShop(shopId ?? ""), enabled: shopId !== undefined });
export const useCashiers = (shopId: string | undefined) => useQuery({ queryKey: keys.cashiers(shopId ?? ""), queryFn: () => adminSource.listCashiers(shopId ?? ""), enabled: shopId !== undefined, placeholderData: keep });
export const useTeams = (leagueId?: string, enabled = true) => useQuery({ queryKey: keys.teams(leagueId), queryFn: () => adminSource.listTeams(leagueId), enabled, placeholderData: keep });
export const useFixtures = (query: AdminFixtureQuery = {}, enabled = true) => useQuery({ queryKey: keys.fixtures(query), queryFn: () => adminSource.listFixtures(query), refetchInterval: SEASON_MS, enabled, placeholderData: keep });
export const useFixture = (matchId: string | undefined) => useQuery({ queryKey: keys.fixture(matchId ?? ""), queryFn: () => adminSource.getFixture(matchId ?? ""), enabled: matchId !== undefined, refetchInterval: 4000, placeholderData: keep });
export const useMarketOdds = (matchId?: string, enabled = true) => useQuery({ queryKey: keys.odds(matchId), queryFn: () => adminSource.listMarketOdds(matchId), refetchInterval: SEASON_MS, enabled, placeholderData: keep });
export const useRisk = () => useQuery({ queryKey: keys.risk, queryFn: () => adminSource.getRiskOverview(), refetchInterval: SEASON_MS, placeholderData: keep });
export const useSimulations = () => useQuery({ queryKey: keys.simulations, queryFn: () => adminSource.listSimulations(), refetchInterval: SEASON_MS, placeholderData: keep });
export const useSettlements = () => useQuery({ queryKey: keys.settlements, queryFn: () => adminSource.listSettlements(), refetchInterval: SEASON_MS, placeholderData: keep });
export const useWalletOverview = () => useQuery({ queryKey: keys.wallet, queryFn: () => adminSource.getWalletOverview(), refetchInterval: 15_000, placeholderData: keep });
export const useReportDays = (from: string, to: string, enabled = true) => useQuery({ queryKey: keys.reports(from, to), queryFn: () => adminSource.listReportDays(from, to), enabled, placeholderData: keep });
export const useAuditLog = (query: AuditLogQuery, enabled = true) => useQuery({ queryKey: keys.audit(query), queryFn: () => adminSource.listAuditLog(query), enabled, placeholderData: keep });
export const useSettings = () => useQuery({ queryKey: keys.settings, queryFn: () => adminSource.getSettings() });

export const useLeagues = () => useQuery({ queryKey: keys.leagues, queryFn: () => dataSource.listLeagues(), staleTime: 60_000 });
export const useStandings = (leagueId: string | undefined) => useQuery({ queryKey: keys.standings(leagueId ?? ""), queryFn: () => dataSource.getStandings(leagueId as LeagueId), enabled: leagueId !== undefined, refetchInterval: 30_000 });
export const useLiveMatches = () => useQuery({ queryKey: keys.liveMatches, queryFn: () => dataSource.listMatches({ phases: ["LIVE", "HALFTIME"] }), refetchInterval: 3000, placeholderData: keep });

export interface ActionOptions<TInput, TResult> {
  readonly run: (input: TInput) => Promise<TResult>;
  readonly success: (result: TResult, input: TInput) => string;
  readonly invalidate?: readonly QueryKey[];
  readonly onDone?: (result: TResult) => void;
}

export function useAdminAction<TInput, TResult>({ run, success, invalidate, onDone }: ActionOptions<TInput, TResult>) {
  const client = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: run,
    onSuccess: (result, input) => {
      toast({ tone: "success", title: success(result, input) });
      for (const queryKey of invalidate ?? [keys.root]) void client.invalidateQueries({ queryKey });
      onDone?.(result);
    },
    onError: (error) => {
      const presented = presentError(error);

      toast({ tone: "danger", title: presented.title, message: presented.message });
    },
  });
}
