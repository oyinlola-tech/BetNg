import Svg, { Circle, Path, Rect } from "react-native-svg";
import { FOOTBALL_EVENT_ICON, FOOTBALL_ICONS, FOOTBALL_ICON_STROKE, FOOTBALL_ICON_VIEWBOX, type FootballIconName, type FootballIconPrimitive } from "@betng/brand";
import type { MatchEventKind } from "@betng/ui-core";
import { useTheme } from "../theme";

export function iconForEvent(kind: MatchEventKind): FootballIconName {
  return (FOOTBALL_EVENT_ICON as Readonly<Record<string, FootballIconName>>)[kind] ?? "whistle";
}

export function FootballIcon({ name, size = 18, color }: { readonly name: FootballIconName; readonly size?: number; readonly color?: string }): React.JSX.Element {
  const t = useTheme();
  const stroke = color ?? t.colors.textSecondary;
  const card = name === "redCard" ? t.colors.danger : t.colors.warning;

  return (
    <Svg width={size} height={size} viewBox={FOOTBALL_ICON_VIEWBOX} fill="none" accessibilityElementsHidden importantForAccessibility="no">
      {(FOOTBALL_ICONS[name] as readonly FootballIconPrimitive[]).map((p, i) => {
        const width = p.strokeWidth ?? FOOTBALL_ICON_STROKE;

        if (p.type === "path") {
          return <Path key={i} d={p.d} stroke={stroke} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" {...(p.strokeDasharray === undefined ? {} : { strokeDasharray: p.strokeDasharray })} />;
        }
        if (p.type === "circle") return <Circle key={i} cx={p.cx} cy={p.cy} r={p.r} stroke={stroke} strokeWidth={width} />;

        const painted = p.paint === "card";

        return (
          <Rect
            key={i}
            x={p.x}
            y={p.y}
            width={p.width}
            height={p.height}
            stroke={painted ? card : stroke}
            strokeWidth={width}
            strokeLinejoin="round"
            fill={painted ? card : "none"}
            {...(p.rx === undefined ? {} : { rx: p.rx })}
            {...(p.transform === undefined ? {} : { transform: p.transform })}
          />
        );
      })}
    </Svg>
  );
}
