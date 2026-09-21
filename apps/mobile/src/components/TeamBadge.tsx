import { useMemo, useState } from "react";
import { Image } from "react-native";
import Svg, { ClipPath, Defs, Path } from "react-native-svg";
import { CREST_VIEWBOX, crestFor, crestLayers, detailFor, shapePath } from "@betng/brand";
import type { TeamView } from "@betng/ui-core";

export type CrestTeam = Pick<TeamView, "id" | "name" | "colors" | "crest">;

function safeAssetUrl(url: string | undefined): string | undefined {
  return url !== undefined && /^https:\/\//i.test(url) ? url : undefined;
}

/** The team's crest: a licensed asset when the platform supplies one, otherwise the generated BETNG crest. */
export function TeamBadge({ team, size = 28, decorative = false }: { readonly team: CrestTeam; readonly size?: number; readonly decorative?: boolean }): React.JSX.Element {
  const [failed, setFailed] = useState(false);
  const { id, colors, crest } = team;
  const clipId = `crest-${id}`;

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

    return { outline: shapePath(spec.shape), layers: crestLayers(spec, detailFor(size)) };
  }, [id, colors, crest, size]);

  const assetUrl = safeAssetUrl(crest?.assetUrl);
  const a11y = decorative ? { accessibilityElementsHidden: true, importantForAccessibility: "no" as const } : { accessible: true, accessibilityRole: "image" as const, accessibilityLabel: team.name };

  if (assetUrl !== undefined && !failed) {
    return <Image source={{ uri: assetUrl }} style={{ width: size, height: size }} resizeMode="contain" onError={() => { setFailed(true); }} {...a11y} />;
  }

  return (
    <Svg width={size} height={size} viewBox={CREST_VIEWBOX} {...a11y}>
      <Defs>
        <ClipPath id={clipId}>
          <Path d={drawing.outline} />
        </ClipPath>
      </Defs>
      {drawing.layers.map((layer, index) => (
        <Path
          key={index}
          d={layer.d}
          fill={layer.fill}
          {...(layer.opacity === undefined ? {} : { opacity: layer.opacity })}
          {...(layer.stroke === undefined ? {} : { stroke: layer.stroke, strokeWidth: layer.strokeWidth ?? 1, strokeLinejoin: "round" as const })}
          {...(layer.clip === true ? { clipPath: `url(#${clipId})` } : {})}
        />
      ))}
    </Svg>
  );
}
