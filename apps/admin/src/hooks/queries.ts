import { useEffect } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import type { AnalyticsDimension, AuditLogQuery, LeagueId, SessionAnalysis } from "@betng/contracts";
import { DataSourceError } from "@betng/ui-core";
import { presentError, useLogger, useToast } from "@betng/ui-web";
import { keys } from "../lib/queryKeys";
import { adminSource, dataSource } from "../services/runtime";

const SLOW_MS = 15_000;
const OPERATING_MS = 10_000;

export interface AnalyticsWindow {
  readonly from?: string;
  readonly to?: string;
}

/** The source signals when something it serves has moved; active queries are re-read, nothing is patched in place. */
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

export const useOverview = () => useQuery({ queryKey: keys.overview, queryFn: () => adminSource.getOverview(), refetchInterval: SLOW_MS, placeholderData: keepPreviousData });
export const useServiceHealth = (enabled = true) => useQuery({ queryKey: keys.health, queryFn: () => adminSource.listServiceHealth(), refetchInterval: SLOW_MS, enabled, placeholderData: keepPreviousData });
export const useShop = (shopId: string | undefined) => useQuery({ queryKey: keys.shop(shopId ?? ""), queryFn: () => adminSource.getShop(shopId ?? ""), enabled: shopId !== undefined });
export const useFixture = (matchId: string | undefined) => useQuery({ queryKey: keys.fixture(matchId ?? ""), queryFn: () => adminSource.getFixture(matchId ?? ""), enabled: matchId !== undefined, refetchInterval: OPERATING_MS, placeholderData: keepPreviousData });
export const useMarketOdds = (matchId?: string, enabled = true) => useQuery({ queryKey: keys.odds(matchId), queryFn: () => adminSource.listMarketOdds(matchId), refetchInterval: OPERATING_MS, enabled, placeholderData: keepPreviousData });
export const useRiskOverview = (enabled = true) => useQuery({ queryKey: keys.risk, queryFn: () => adminSource.getRiskOverview(), refetchInterval: SLOW_MS, enabled, placeholderData: keepPreviousData });
export const useExposure = (enabled = true) => useQuery({ queryKey: keys.exposure, queryFn: () => adminSource.listExposure(), refetchInterval: SLOW_MS, enabled, placeholderData: keepPreviousData });
export const useRiskLimits = () => useQuery({ queryKey: keys.riskLimits, queryFn: () => adminSource.getRiskLimits(), staleTime: 30_000 });
export const useWalletOverview = () => useQuery({ queryKey: keys.wallet, queryFn: () => adminSource.getWalletOverview(), refetchInterval: 30_000, placeholderData: keepPreviousData });
export const useReportDays = (from: string, to: string, enabled = true) => useQuery({ queryKey: keys.reports(from, to), queryFn: () => adminSource.listReportDays(from, to), enabled, staleTime: 60_000, placeholderData: keepPreviousData });
export const useAuditLog = (query: AuditLogQuery, enabled = true) => useQuery({ queryKey: keys.audit(query), queryFn: () => adminSource.listAuditLog(query), enabled, placeholderData: keepPreviousData });
export const useSettings = () => useQuery({ queryKey: keys.settings, queryFn: () => adminSource.getSettings(), staleTime: 30_000 });

export const useAnalyticsOverview = (window: AnalyticsWindow = {}, enabled = true) =>
  useQuery({ queryKey: keys.analyticsOverview(window), queryFn: () => adminSource.getAnalyticsOverview(window), enabled, staleTime: 30_000, refetchInterval: 60_000, placeholderData: keepPreviousData });

export const useAnalyticsBreakdown = (by: AnalyticsDimension, window: AnalyticsWindow, limit: number) =>
  useQuery({ queryKey: keys.analyticsBreakdown({ by, ...window, limit }), queryFn: () => adminSource.getAnalyticsBreakdown({ by, ...window, limit }), staleTime: 30_000, placeholderData: keepPreviousData });

export const useAnalyticsSessions = (kind: SessionAnalysis["kind"], window: AnalyticsWindow) =>
  useQuery({ queryKey: keys.analyticsSessions({ kind, ...window }), queryFn: () => adminSource.listAnalyticsSessions({ kind, ...window }), staleTime: 30_000, placeholderData: keepPreviousData });

export const useAccountAnalysis = (kind: "accounts" | "shops" | "cashiers" | undefined, id: string | undefined, window: AnalyticsWindow) =>
  useQuery({
    queryKey: keys.accountAnalysis(kind ?? "", id ?? "", window),
    queryFn: () => adminSource.getAccountAnalysis(kind ?? "accounts", id ?? "", window),
    enabled: kind !== undefined && id !== undefined,
    staleTime: 30_000,
  });

export const useOperatorLedger = (enabled = true) => useQuery({ queryKey: keys.operatorLedger, queryFn: () => adminSource.getOperatorLedger(), enabled, staleTime: 15_000, refetchInterval: 60_000, placeholderData: keepPreviousData });
export const useOperatorPeriods = () => useQuery({ queryKey: keys.operatorPeriods, queryFn: () => adminSource.listOperatorPeriods(), staleTime: 30_000, placeholderData: keepPreviousData });
export const useCommission = (periodId?: string) => useQuery({ queryKey: keys.commission(periodId), queryFn: () => adminSource.listCommission(periodId), staleTime: 30_000, placeholderData: keepPreviousData });
export const useCommissionConfig = () => useQuery({ queryKey: keys.commissionConfig, queryFn: () => adminSource.getCommissionConfig(), staleTime: 30_000 });

/** Shop codes for labels and filter menus. A reference read, capped by the platform's page size; tables never filter on it. */
export const useShopDirectory = (enabled = true) =>
  useQuery({ queryKey: keys.shopDirectory, queryFn: () => adminSource.queryList("shops", { page: 1, pageSize: 100, sort: "code", direction: "asc" }), enabled, staleTime: 60_000, select: (page) => page.items });

/** The size of a filtered list as the platform counts it. Only `total` is read. */
export const useListTotal = (resource: "settlements" | "simulations" | "fixtures", filters: Readonly<Record<string, string>>, enabled = true) =>
  useQuery({ queryKey: keys.listTotal(resource, filters), queryFn: () => adminSource.queryList(resource, { page: 1, pageSize: 1, filters }), enabled, refetchInterval: 30_000, select: (page) => page.total });

export const useLeagues = () => useQuery({ queryKey: keys.leagues, queryFn: () => dataSource.listLeagues(), staleTime: 60_000 });
export const useStandings = (leagueId: string | undefined) => useQuery({ queryKey: keys.standings(leagueId ?? ""), queryFn: () => dataSource.getStandings(leagueId as LeagueId), enabled: leagueId !== undefined, staleTime: 30_000 });
export const useLiveMatches = () => useQuery({ queryKey: keys.liveMatches, queryFn: () => dataSource.listMatches({ phases: ["LIVE", "HALFTIME"] }), refetchInterval: OPERATING_MS, placeholderData: keepPreviousData });

export interface ActionOptions<TInput, TResult> {
  readonly run: (input: TInput) => Promise<TResult>;
  readonly success: (result: TResult, input: TInput) => string;
  readonly invalidate?: readonly QueryKey[];
  readonly onDone?: (result: TResult) => void;
  /** Set when the form shows the failure itself (field errors, a form-level alert). */
  readonly silentError?: boolean;
}

/** One shape for every admin write: run it, say what happened, then re-read. Nothing is updated optimistically. */
export function useAdminAction<TInput, TResult>({ run, success, invalidate, onDone, silentError = false }: ActionOptions<TInput, TResult>) {
  const client = useQueryClient();
  const logger = useLogger();
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
      const refused = error instanceof DataSourceError && error.code === "CONFLICT";

      logger.warn("flow", "An admin action failed", { code: presented.code ?? "UNKNOWN" });

      if (silentError) return;

      toast({ tone: presented.tone === "info" ? "info" : presented.tone === "warning" ? "warning" : "danger", title: refused ? "Refused by the platform" : presented.title, message: presented.message });
    },
  });
}

export const useTopCashiers = (shopId: string | undefined, enabled = true) =>
  useQuery({
    queryKey: keys.list("cashiers", { top: shopId ?? "" }),
    queryFn: () => adminSource.queryList("cashiers", { page: 1, pageSize: 10, sort: "todaySales", direction: "desc", filters: { shopId: shopId ?? "" } }),
    enabled: enabled && shopId !== undefined,
    staleTime: 30_000,
    select: (page) => page.items,
  });

export const useMatchSimulation = (matchId: string | undefined, enabled = true) =>
  useQuery({
    queryKey: keys.list("simulations", { matchId: matchId ?? "" }),
    queryFn: () => adminSource.queryList("simulations", { page: 1, pageSize: 1, filters: { matchId: matchId ?? "" } }),
    enabled: enabled && matchId !== undefined,
    refetchInterval: OPERATING_MS,
    select: (page) => page.items.find((run) => run.matchId === matchId),
  });

/** Settlement rows carry a match label and no match id, so the platform's search is the only way to ask for one match. */
export const useMatchSettlements = (matchLabel: string | undefined, enabled = true) =>
  useQuery({
    queryKey: keys.list("settlements", { matchLabel: matchLabel ?? "" }),
    queryFn: () => adminSource.queryList("settlements", { page: 1, pageSize: 10, sort: "timestamp", direction: "desc", search: matchLabel ?? "" }),
    enabled: enabled && matchLabel !== undefined,
    refetchInterval: SLOW_MS,
    select: (page) => ({ items: page.items.filter((row) => row.matchLabel === matchLabel), total: page.total }),
  });
