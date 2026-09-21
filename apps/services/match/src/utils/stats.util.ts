import type { SideStats } from "@betng/contracts";
import { z } from "@zudojs/validation";
import type { SimulationEventRow } from "../interfaces/index.js";

const count = z.number().min(0).max(1000);

const sideTotalsSchema = z.object({
  possession: z.number().min(0).max(100),
  shots: count,
  shotsOnTarget: count.optional(),
  shots_on_target: count.optional(),
  fouls: count,
  offsides: count,
});

export const resultStatsSchema = z.object({
  home: sideTotalsSchema,
  away: sideTotalsSchema,
});

type SideTotals = z.infer<typeof sideTotalsSchema>;

interface RevealedCounts {
  goals: number;
  corners: number;
  yellowCards: number;
  redCards: number;
}

function countRevealed(
  events: readonly SimulationEventRow[],
  side: "HOME" | "AWAY",
): RevealedCounts {
  const counts: RevealedCounts = {
    goals: 0,
    corners: 0,
    yellowCards: 0,
    redCards: 0,
  };

  for (const event of events) {
    if (event.side !== side) continue;
    if (event.type === "GOAL") counts.goals += 1;
    if (event.type === "CORNER") counts.corners += 1;
    if (event.type === "YELLOW_CARD") counts.yellowCards += 1;
    if (event.type === "RED_CARD") counts.redCards += 1;
  }

  return counts;
}

function scale(total: number, fraction: number): number {
  return fraction >= 1 ? Math.round(total) : Math.floor(total * fraction);
}

function sideStats(
  totals: SideTotals,
  possession: number,
  revealed: RevealedCounts,
  fraction: number,
): SideStats {
  const onTarget = Math.max(
    revealed.goals,
    scale(totals.shotsOnTarget ?? totals.shots_on_target ?? 0, fraction),
  );

  return {
    possession,
    shots: Math.max(onTarget, scale(totals.shots, fraction)),
    shotsOnTarget: onTarget,
    corners: revealed.corners,
    fouls: scale(totals.fouls, fraction),
    offsides: scale(totals.offsides, fraction),
    yellowCards: revealed.yellowCards,
    redCards: revealed.redCards,
  };
}

export function liveStats(
  totals: z.infer<typeof resultStatsSchema>,
  revealedEvents: readonly SimulationEventRow[],
  fraction: number,
): { readonly home: SideStats; readonly away: SideStats } {
  const played = Math.min(1, Math.max(0, fraction));
  const homePossession = Math.round(
    50 + (totals.home.possession - 50) * played,
  );

  return {
    home: sideStats(
      totals.home,
      homePossession,
      countRevealed(revealedEvents, "HOME"),
      played,
    ),
    away: sideStats(
      totals.away,
      100 - homePossession,
      countRevealed(revealedEvents, "AWAY"),
      played,
    ),
  };
}
