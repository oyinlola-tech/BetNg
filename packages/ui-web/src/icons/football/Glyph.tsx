import {
  FOOTBALL_ICONS,
  type FootballIconName,
  type FootballIconPrimitive,
} from "@betng/brand";
import { IconBase, type FootballIconProps } from "./IconBase";

export interface GlyphProps extends FootballIconProps {
  readonly name: FootballIconName;
}

/** Draws an icon from the shared geometry in `@betng/brand`, which TV and mobile render too. */
export function Glyph({ name, ...props }: GlyphProps): React.JSX.Element {
  return (
    <IconBase {...props}>
      {FOOTBALL_ICONS[name].map((p: FootballIconPrimitive, index) => {
        const key = `${p.type}-${String(index)}`;

        if (p.type === "path") {
          return (
            <path
              key={key}
              d={p.d}
              {...(p.strokeWidth === undefined ? {} : { strokeWidth: p.strokeWidth })}
              {...(p.strokeDasharray === undefined ? {} : { strokeDasharray: p.strokeDasharray })}
            />
          );
        }

        if (p.type === "circle") {
          return <circle key={key} cx={p.cx} cy={p.cy} r={p.r} {...(p.strokeWidth === undefined ? {} : { strokeWidth: p.strokeWidth })} />;
        }

        return (
          <rect
            key={key}
            x={p.x}
            y={p.y}
            width={p.width}
            height={p.height}
            {...(p.rx === undefined ? {} : { rx: p.rx })}
            {...(p.transform === undefined ? {} : { transform: p.transform })}
            {...(p.strokeWidth === undefined ? {} : { strokeWidth: p.strokeWidth })}
          />
        );
      })}
    </IconBase>
  );
}
