import { cn } from "../lib/cn";

export function StatRow({
  label,
  home,
  away,
  percent = false,
}: {
  readonly label: string;
  readonly home: number;
  readonly away: number;
  readonly percent?: boolean;
}): React.JSX.Element {
  const total = home + away;
  const share = total === 0 ? 50 : (home / total) * 100;

  return (
    <div className="grid grid-cols-[3.5rem_1fr_3.5rem] items-center gap-[0.8rem]">
      <span
        className={cn(
          "text-right font-display text-[1.5rem] font-black tabular",
          home >= away ? "text-text-primary" : "text-text-muted",
        )}
      >
        {home}
        {percent ? "%" : ""}
      </span>
      <div>
        <p className="caps-label text-center">{label}</p>
        <div className="mt-[0.3rem] flex h-[0.5rem] gap-[0.15rem] overflow-hidden rounded-full">
          <div className="bg-brand" style={{ width: `${String(share)}%` }} />
          <div
            className="bg-border-strong"
            style={{ width: `${String(100 - share)}%` }}
          />
        </div>
      </div>
      <span
        className={cn(
          "font-display text-[1.5rem] font-black tabular",
          away >= home ? "text-text-primary" : "text-text-muted",
        )}
      >
        {away}
        {percent ? "%" : ""}
      </span>
    </div>
  );
}
