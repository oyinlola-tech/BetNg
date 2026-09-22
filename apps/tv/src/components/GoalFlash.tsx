import type { Score, TeamView } from "@betng/ui-core";
import type { GoalFlash as Flash } from "../hooks/useGoalFlash";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { cn } from "../lib/cn";
import { TeamMark } from "./TeamMark";

/* The celebration is the same for either side; it names who scored and shows the platform's new score. */
export function GoalFlash({
  flash,
  home,
  away,
  score,
  compact = false,
}: {
  readonly flash: Flash | undefined;
  readonly home: TeamView;
  readonly away: TeamView;
  readonly score: Score;
  readonly compact?: boolean;
}): React.JSX.Element | null {
  const reduced = useReducedMotion();

  if (flash === undefined) return null;

  const scorers = flash.side === "HOME" ? [home] : flash.side === "AWAY" ? [away] : [home, away];
  const lead = scorers[0] as TeamView;

  return (
    <div
      key={flash.key}
      role="status"
      aria-live="assertive"
      data-motion={reduced ? "reduced" : "full"}
      data-side={flash.side}
      className={cn("pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/70", !reduced && "animate-fade-in")}
    >
      <div
        className={cn("flex items-center gap-[1.4rem] rounded-lg border-[0.25rem] px-[2.4rem] py-[1.4rem] shadow-lg", compact && "gap-[0.8rem] px-[1.2rem] py-[0.7rem]", !reduced && "animate-goal-in")}
        style={{ background: lead.colors.primary, color: lead.colors.onPrimary, borderColor: lead.colors.secondary }}
      >
        {scorers.map((team) => (
          <TeamMark key={team.id} team={team} size={compact ? "md" : "hero"} />
        ))}
        <div className="text-center">
          <p className={cn("font-display font-black uppercase leading-none tracking-tight", compact ? "text-[2.4rem]" : "text-[6rem]", !reduced && "animate-goal-flash")}>Goal</p>
          <p className={cn("mt-[0.3rem] font-bold", compact ? "text-[1rem]" : "text-[1.8rem]")}>{scorers.map((t) => t.name).join(" and ")}</p>
          <p className={cn("font-display font-black tabular", compact ? "text-[1.4rem]" : "text-[2.6rem]")}>
            {home.code} {score.home} – {score.away} {away.code}
          </p>
        </div>
      </div>
    </div>
  );
}
