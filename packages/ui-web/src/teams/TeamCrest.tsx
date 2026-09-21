import { useId, useMemo, useState } from "react";
import { CREST_VIEWBOX, crestFor, crestLayers, detailFor, shapePath } from "@betng/brand";
import type { CrestSize } from "@betng/design-tokens";
import type { TeamView } from "@betng/ui-core";
import { cn } from "../lib/cn";

export type TeamCrestTeam = Pick<TeamView, "id" | "name" | "colors" | "crest">;

export interface TeamCrestProps {
  readonly team: TeamCrestTeam;
  readonly size?: CrestSize;
  readonly className?: string;
  readonly title?: string;
  readonly decorative?: boolean;
}

function safeAssetUrl(url: string | undefined): string | undefined {
  if (url === undefined) return undefined;

  return /^(https?:\/\/|\/(?!\/)|\.{1,2}\/)/i.test(url) ? url : undefined;
}

export function TeamCrest({ team, size = 32, className, title, decorative = false }: TeamCrestProps): React.JSX.Element {
  const clipId = useId();
  const [failedUrl, setFailedUrl] = useState<string | undefined>(undefined);
  const { id, colors, crest } = team;
  const primary = colors.primary;
  const secondary = colors.secondary;
  const onPrimary = colors.onPrimary;
  const shape = crest?.shape;
  const pattern = crest?.pattern;
  const emblem = crest?.emblem;
  const accent = crest?.accent;

  const layers = useMemo(() => {
    const spec = crestFor({
      id,
      colors: { primary, secondary, onPrimary },
      crest: {
        ...(shape !== undefined && { shape }),
        ...(pattern !== undefined && { pattern }),
        ...(emblem !== undefined && { emblem }),
        ...(accent !== undefined && { accent }),
      },
    });

    return { shape: shapePath(spec.shape), paths: crestLayers(spec, detailFor(size)) };
  }, [id, primary, secondary, onPrimary, shape, pattern, emblem, accent, size]);

  const label = title ?? team.name;
  const assetUrl = safeAssetUrl(crest?.assetUrl);

  if (assetUrl !== undefined && assetUrl !== failedUrl) {
    return (
      <img
        src={assetUrl}
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        alt={decorative ? "" : label}
        onError={() => {
          setFailedUrl(assetUrl);
        }}
        className={cn("inline-block shrink-0 object-contain", className)}
      />
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={CREST_VIEWBOX}
      className={cn("inline-block shrink-0", className)}
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": label })}
    >
      <defs>
        <clipPath id={clipId}>
          <path d={layers.shape} />
        </clipPath>
      </defs>
      {layers.paths.map((layer, index) => (
        <path
          key={index}
          d={layer.d}
          fill={layer.fill}
          strokeLinejoin="round"
          {...(layer.stroke !== undefined && { stroke: layer.stroke, strokeWidth: layer.strokeWidth ?? 1 })}
          {...(layer.opacity !== undefined && { opacity: layer.opacity })}
          {...(layer.clip === true && { clipPath: `url(#${clipId})` })}
        />
      ))}
    </svg>
  );
}
