import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { formatMoney, type BetSignal, type BetView, type NotificationPreferences } from "@betng/ui-core";
import { useToast, type ToastInput } from "@betng/ui-web";
import { useSlipOutcome } from "../features/betslip/outcome.store";
import { keys } from "../lib/queryKeys";
import { dataSource, logger } from "../services/runtime";
import { useSignedIn } from "./accountQueries";

const SETTLED = new Set<BetView["status"]>(["WON", "LOST", "VOID", "CANCELLED"]);

/** The wording comes only from the bet as the platform reports it after the re-read, never from the signal. */
export function settledToast(bet: BetView): Omit<ToastInput, "action"> | undefined {
  const ticket = bet.reference === undefined ? undefined : `Ticket ${bet.reference}`;

  switch (bet.status) {
    case "WON":
      return {
        tone: "success",
        kind: "bet",
        title: bet.payout === undefined ? "Bet settled — won" : `Bet settled — won ${formatMoney(bet.payout)}`,
        ...(ticket === undefined ? {} : { message: ticket }),
      };
    case "LOST":
      return { tone: "info", kind: "bet", title: "Bet settled — lost", ...(ticket === undefined ? {} : { message: ticket }) };
    case "VOID":
      return {
        tone: "info",
        kind: "bet",
        title: "Bet void",
        message: bet.payout === undefined ? "The platform voided this bet." : `The platform voided this bet and returned ${formatMoney(bet.payout)}.`,
      };
    case "CANCELLED":
      return { tone: "info", kind: "bet", title: "Bet cancelled", ...(ticket === undefined ? {} : { message: ticket }) };
    default:
      return undefined;
  }
}

function acceptedToast(bet: BetView): Omit<ToastInput, "action"> {
  return { tone: "success", kind: "bet", title: "Bet accepted", message: bet.reference === undefined ? "Your ticket is open." : `Ticket ${bet.reference} is open.` };
}

interface AnnouncementContext {
  readonly wantsSettled: boolean;
  readonly placedId: string | undefined;
}

function announcement(
  signal: BetSignal,
  bet: BetView,
  previous: BetView["status"] | undefined,
  context: AnnouncementContext,
): Omit<ToastInput, "action"> | undefined {
  const named = signal.betId === bet.id;

  if (SETTLED.has(bet.status)) {
    const fresh = previous === "PENDING" || (named && previous === undefined);

    return fresh && context.wantsSettled ? settledToast(bet) : undefined;
  }

  return signal.kind === "BET_ACCEPTED" && named && previous === undefined && context.placedId !== bet.id ? acceptedToast(bet) : undefined;
}

function cachedStatuses(client: QueryClient): ReadonlyMap<string, BetView["status"]> {
  const list = client.getQueryData<readonly BetView[]>(keys.bets) ?? [];

  return new Map(list.map((bet) => [bet.id, bet.status]));
}

async function reread(client: QueryClient, signal: BetSignal): Promise<readonly BetView[]> {
  if (signal.betId !== undefined) {
    const id = signal.betId;

    return [await client.fetchQuery({ queryKey: keys.bet(id), queryFn: () => dataSource.getBet(id), staleTime: 0 })];
  }

  return client.fetchQuery({ queryKey: keys.bets, queryFn: () => dataSource.listBets(), staleTime: 0 });
}

/** Re-reads bets, tickets and the wallet when the platform signals a bet change, and announces what the re-read shows. */
export function useBetSignals(): void {
  const client = useQueryClient();
  const signedIn = useSignedIn();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!signedIn || dataSource.subscribeBetSignals === undefined) return;

    const announced = new Set<string>();
    let active = true;

    const unsubscribe = dataSource.subscribeBetSignals((signal) => {
      const before = cachedStatuses(client);

      void client.invalidateQueries({ queryKey: keys.wallet });
      void client.invalidateQueries({ queryKey: keys.transactionsRoot });

      reread(client, signal)
        .then((bets) => {
          const fetched = JSON.stringify(signal.betId === undefined ? keys.bets : keys.bet(signal.betId));

          void client.invalidateQueries({ queryKey: keys.bets, predicate: (query) => JSON.stringify(query.queryKey) !== fetched });

          if (!active) return;

          const wantsSettled = client.getQueryData<NotificationPreferences>(keys.preferences)?.betSettled !== false;
          const placedHere = useSlipOutcome.getState().outcome;
          const placedId = placedHere?.kind === "PLACED" ? placedHere.placement.bet?.id : undefined;

          for (const bet of bets) {
            const key = `${bet.id}:${bet.status}`;

            if (announced.has(key)) continue;

            const content = announcement(signal, bet, before.get(bet.id), { wantsSettled, placedId });

            if (content === undefined) continue;

            announced.add(key);
            toast({
              ...content,
              action: {
                label: "View ticket",
                onSelect: () => {
                  void navigate(`/tickets/${bet.id}`);
                },
              },
            });
          }
        })
        .catch((error: unknown) => {
          void client.invalidateQueries({ queryKey: keys.bets });
          logger.warn("realtime", "A bet could not be re-read after a signal", { error: error instanceof Error ? error.name : "unknown" });
        });
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [client, signedIn, toast, navigate]);
}
