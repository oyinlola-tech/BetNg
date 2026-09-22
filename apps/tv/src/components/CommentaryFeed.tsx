import type { FeedItem, Severity } from "../lib/commentary";
import { cn } from "../lib/cn";
import { follows, useFavourites } from "../lib/favourites";
import { clockTime } from "./ConnectionPill";
import { FavouriteMark } from "./FavouriteMark";
import { FootballIcon, iconForEvent } from "./FootballIcon";
import { VirtualList } from "./VirtualList";

const ROW_REM: Readonly<Record<Severity, number>> = { major: 5.4, medium: 3.4, minor: 2.5 };

function rule(item: FeedItem): string {
  if (item.severity === "major") return "border-l-text-primary";
  if (item.kind === "RED_CARD") return "border-l-danger";
  if (item.kind === "YELLOW_CARD") return "border-l-warning";

  return "border-l-border-strong";
}

function Row({ item, followed }: { readonly item: FeedItem; readonly followed: boolean }): React.JSX.Element {
  const major = item.severity === "major";
  const minor = item.severity === "minor";

  return (
    <div
      data-severity={item.severity}
      className={cn(
        "mb-[0.3rem] grid h-[calc(100%-0.3rem)] items-center gap-[0.9rem] border-l-[0.3rem] pl-[0.9rem] pr-[0.8rem]",
        major ? "grid-cols-[4.2rem_2.4rem_1fr_auto] bg-surface-elevated" : "grid-cols-[4.2rem_1.8rem_1fr_auto] bg-surface",
        rule(item),
      )}
    >
      <span className="flex flex-col leading-tight">
        <span className={cn("font-display font-black tabular", major ? "text-[1.6rem]" : "text-[1.1rem] text-text-secondary")}>{item.minute}'</span>
        {item.at !== undefined && <span className="text-[0.72rem] tabular text-text-muted">{clockTime(item.at)}</span>}
      </span>
      <FootballIcon name={iconForEvent(item.kind)} className={cn(major ? "size-[2.2rem]" : "size-[1.5rem]", minor ? "text-text-muted" : "text-text-secondary")} />
      <span className="min-w-0">
        <span className={cn("block truncate font-display font-black uppercase leading-none tracking-tight", major ? "text-[2rem]" : minor ? "text-[0.95rem] text-text-secondary" : "text-[1.25rem]")}>
          {item.headline}
          {item.teamCode !== undefined && <span className={cn("ml-[0.5em] font-sans font-bold", major ? "text-[1.1rem]" : "text-[0.85rem]", "text-text-muted")}>{item.teamCode}</span>}
        </span>
        {!minor && <span className={cn("block truncate", major ? "mt-[0.3rem] text-[1.15rem] font-semibold" : "text-[0.95rem] text-text-secondary")}>{item.detail}</span>}
      </span>
      <span className={cn("flex items-center gap-[0.4rem] whitespace-nowrap font-display font-black tabular", major ? "text-[1.4rem]" : "text-[1rem] text-text-secondary")}>
        {followed && <FavouriteMark className="text-[0.9rem]" />}
        {item.home} {item.score.home}–{item.score.away} {item.away}
      </span>
    </div>
  );
}

export function CommentaryFeed({ items, className }: { readonly items: readonly FeedItem[]; readonly className?: string }): React.JSX.Element {
  const favourites = useFavourites();

  return (
    <VirtualList
      label="Live commentary"
      items={items}
      keyOf={(item) => item.key}
      heightOf={(item) => ROW_REM[item.severity]}
      render={(item) => <Row item={item} followed={follows(favourites, ...item.teamIds)} />}
      {...(className === undefined ? {} : { className })}
    />
  );
}
