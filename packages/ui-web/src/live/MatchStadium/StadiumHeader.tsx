import type {
  LiveConnectionStatus,
  MatchPhase,
  Score,
  TeamView,
} from "@betng/ui-core";
import { isInPlay, phaseLabel } from "@betng/ui-core";
import { LiveDot } from "../../domain/LiveDot";
import { cn } from "../../lib/cn";
import { TeamCrest } from "../../teams";

/*
 * The scoreboard over the pitch: who, what the score is, and how far into the
 * match we are. Every value comes from the platform — the minute shown here is
 * the one it reported, advanced only where its clock contract allows it.
 */

const STALE_WORD: Readonly<Partial<Record<LiveConnectionStatus, string>>> = {
  CONNECTING: "Connecting",
  RECONNECTING: "Reconnecting",
  OFFLINE: "Offline",
  FAILED: "Disconnected",
  STALE: "Delayed",
};

export interface StadiumHeaderProps {
  readonly home: TeamView;
  readonly away: TeamView;
  readonly score: Score;
  readonly phase: MatchPhase;
  /** The clock text the caller resolved: "43'", "HT", "FT". */
  readonly clockText: string;
  readonly connection: LiveConnectionStatus;
  readonly compact?: boolean;
  readonly className?: string | undefined;
}

export function StadiumHeader({
  home,
  away,
  score,
  phase,
  clockText,
  connection,
  compact = false,
  className,
}: StadiumHeaderProps): React.JSX.Element {
  const live = isInPlay(phase);
  const warning = STALE_WORD[connection];

  return (
    <div
      className={cn(
        "flex items-center gap-3 border-b border-border bg-surface-elevated px-3 py-2",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <TeamCrest team={home} size={compact ? 20 : 32} decorative />
        <span
          className={cn(
            "min-w-0 truncate font-semibold",
            compact ? "text-sm" : "type-body",
          )}
        >
          {compact ? home.code : home.shortName}
        </span>
      </div>

      <div className="flex shrink-0 flex-col items-center gap-0.5">
        <span
          className={cn(
            "type-score tabular font-extrabold leading-none",
            compact ? "text-2xl" : "text-3xl",
          )}
        >
          {score.home} – {score.away}
        </span>
        <span
          className={cn(
            "type-data inline-flex items-center gap-1.5 text-sm",
            live ? "text-live" : "text-text-muted",
          )}
        >
          {phase === "LIVE" && <LiveDot />}
          {clockText === "" ? phaseLabel(phase) : clockText}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
        <span
          className={cn(
            "min-w-0 truncate text-right font-semibold",
            compact ? "text-sm" : "type-body",
          )}
        >
          {compact ? away.code : away.shortName}
        </span>
        <TeamCrest team={away} size={compact ? 20 : 32} decorative />
      </div>

      {warning !== undefined && (
        <span
          role="status"
          className="type-small absolute right-3 top-full mt-1 rounded-sm border border-border bg-surface-elevated px-2 py-0.5 font-semibold text-text-secondary"
        >
          {warning}
        </span>
      )}
    </div>
  );
}
