import { useId, useMemo } from "react";
import { CREST_VIEWBOX, crestFor, crestLayers, detailFor, shapePath } from "@betng/brand";
import type { TeamView } from "@betng/ui-core";
import { cn } from "../lib/cn";

export type CrestTeam = Pick<TeamView, "id" | "name" | "colors" | "crest">;

const SIZES = {
  sm: { box: "size-[2.25rem]", px: 36 },
  md: { box: "size-[3rem]", px: 48 },
  lg: { box: "size-[5rem]", px: 80 },
  hero: { box: "size-[7.5rem]", px: 128 },
  xl: { box: "size-[10rem]", px: 160 },
} as const;

function safeAssetUrl(url: string | undefined): string | undefined {
  return url !== undefined && /^(https?:\/\/|\/(?!\/))/i.test(url) ? url : undefined;
}

export function TeamMark({ team, size = "md", className }: { readonly team: CrestTeam; readonly size?: keyof typeof SIZES; readonly className?: string }): React.JSX.Element {
  const clipId = useId();
  const { id, colors, crest } = team;
  const { box, px } = SIZES[size];

  const drawing = useMemo(() => {
    const spec = crestFor({
      id,
      colors,
      crest: {
        ...(crest?.shape !== undefined && { shape: crest.shape }),
        ...(crest?.pattern !== undefined && { pattern: crest.pattern }),
        ...(crest?.emblem !== undefined && { emblem: crest.emblem }),
        ...(crest?.accent !== undefined && { accent: crest.accent }),
      },
    });

    return { outline: shapePath(spec.shape), layers: crestLayers(spec, detailFor(px)) };
  }, [id, colors, crest, px]);

  const assetUrl = safeAssetUrl(crest?.assetUrl);

  if (assetUrl !== undefined) return <img src={assetUrl} alt={team.name} className={cn("inline-block shrink-0 object-contain", box, className)} />;

  return (
    <svg viewBox={CREST_VIEWBOX} role="img" aria-label={team.name} className={cn("inline-block shrink-0", box, className)}>
      <defs>
        <clipPath id={clipId}>
          <path d={drawing.outline} />
        </clipPath>
      </defs>
      {drawing.layers.map((layer, index) => (
        <path
          key={index}
          d={layer.d}
          fill={layer.fill}
          opacity={layer.opacity}
          stroke={layer.stroke}
          strokeWidth={layer.stroke === undefined ? undefined : (layer.strokeWidth ?? 1)}
          strokeLinejoin={layer.stroke === undefined ? undefined : "round"}
          clipPath={layer.clip === true ? `url(#${clipId})` : undefined}
        />
      ))}
    </svg>
  );
}
