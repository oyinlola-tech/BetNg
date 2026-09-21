import { FOOTBALL_EVENT_ICON, FOOTBALL_ICONS, FOOTBALL_ICON_STROKE, FOOTBALL_ICON_VIEWBOX, type FootballIconName, type FootballIconPrimitive } from "@betng/brand";
import type { MatchEventKind } from "@betng/ui-core";
import { cn } from "../lib/cn";

export function iconForEvent(kind: MatchEventKind): FootballIconName {
  return (FOOTBALL_EVENT_ICON as Readonly<Record<string, FootballIconName>>)[kind] ?? "whistle";
}

export function FootballIcon({ name, className }: { readonly name: FootballIconName; readonly className?: string }): React.JSX.Element {
  const card = name === "redCard" ? "var(--bn-danger)" : "var(--bn-warning)";

  return (
    <svg viewBox={FOOTBALL_ICON_VIEWBOX} fill="none" stroke="currentColor" strokeWidth={FOOTBALL_ICON_STROKE} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={cn("inline-block shrink-0", className)}>
      {(FOOTBALL_ICONS[name] as readonly FootballIconPrimitive[]).map((p, i) => {
        if (p.type === "path") return <path key={i} d={p.d} strokeWidth={p.strokeWidth} strokeDasharray={p.strokeDasharray} />;
        if (p.type === "circle") return <circle key={i} cx={p.cx} cy={p.cy} r={p.r} strokeWidth={p.strokeWidth} />;

        const painted = p.paint === "card";

        return <rect key={i} x={p.x} y={p.y} width={p.width} height={p.height} rx={p.rx} transform={p.transform} strokeWidth={p.strokeWidth} fill={painted ? card : undefined} stroke={painted ? card : undefined} />;
      })}
    </svg>
  );
}
