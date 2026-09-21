import { INK, PAPER, contrast, luminance, mix } from "./color.js";
import { EMBLEMS, EMBLEM_BOX } from "./emblems.js";
import { transformPath } from "./path.js";
import { PATTERNS } from "./patterns.js";
import { SHAPES, shapeInset } from "./shapes.js";
import type { CrestDetail, CrestLayer, CrestSpec } from "./types.js";

const KEYLINE_INSET = 0.87;

function rimColor(spec: CrestSpec): string {
  const darker = luminance(spec.primary) <= luminance(spec.secondary) ? spec.primary : spec.secondary;
  const l = luminance(darker);

  if (l < 0.02) return mix(darker, PAPER, 0.22);

  return mix(darker, "#000000", l > 0.3 ? 0.55 : 0.4);
}

function disc(cx: number, cy: number, r: number): string {
  const f = (v: number): string => String(Math.round(v * 100) / 100);

  return `M${f(cx - r)} ${f(cy)}A${f(r)} ${f(r)} 0 1 1 ${f(cx + r)} ${f(cy)}A${f(r)} ${f(r)} 0 1 1 ${f(cx - r)} ${f(cy)}Z`;
}

function inkFor(background: string, candidates: readonly string[]): string {
  const readable = candidates.find((c) => contrast(c, background) >= 3);

  if (readable !== undefined) return readable;

  return [...candidates].sort((a, b) => contrast(b, background) - contrast(a, background))[0] ?? INK;
}

function bestAcross(candidates: readonly string[], a: string, b: string): { readonly color: string; readonly contrast: number } {
  let best = { color: INK, contrast: 0 };

  for (const color of candidates) {
    const worst = Math.min(contrast(color, a), contrast(color, b));

    if (worst > best.contrast) best = { color, contrast: worst };
  }

  return best;
}

export function crestLayers(spec: CrestSpec, detail: CrestDetail): readonly CrestLayer[] {
  const shape = SHAPES[spec.shape];
  const pattern = PATTERNS[spec.pattern];
  const rim = rimColor(spec);
  const layers: CrestLayer[] = [{ d: shape.d, fill: spec.primary }];

  for (const p of pattern.draw({ shape: spec.shape, cy: shape.cy, detail })) {
    layers.push({ d: p.d, fill: p.paint === "primary" ? spec.primary : spec.secondary, clip: true });
  }

  if (detail === "full") layers.push({ d: "M32 0H64V64H32Z", fill: "#000000", opacity: 0.07, clip: true });

  if (detail !== "minimal" && spec.emblem !== "none") {
    const def = EMBLEMS[spec.emblem];
    const size = shape.emblem * (pattern.emblemScale ?? 1);
    const cy = shape.cy + (pattern.emblemDy ?? 0);
    const mixedInk = pattern.field === "mixed" ? bestAcross([spec.accent, INK, PAPER], spec.primary, spec.secondary) : undefined;
    const plated = pattern.plate === "always" || (mixedInk !== undefined && mixedInk.contrast < 3);
    const under = plated || pattern.field === "primary" ? spec.primary : spec.secondary;
    const ink = plated || pattern.field === "primary" ? spec.accent : (mixedInk?.color ?? inkFor(under, [spec.accent, spec.primary, INK, PAPER]));
    const scale = ((plated ? (detail === "full" ? 0.8 : 0.88) : 1) * size) / EMBLEM_BOX;
    const half = (EMBLEM_BOX * scale) / 2;
    const d = transformPath(detail === "full" ? def.full : (def.simple ?? def.full), scale, 32 - half, cy - half);

    if (plated) {
      layers.push({ d: disc(32, cy, size * 0.57), fill: spec.primary, clip: true, stroke: detail === "full" ? spec.accent : rim, strokeWidth: detail === "full" ? 1.4 : 1.8 });
    } else if (pattern.field === "mixed") {
      layers.push({ d, fill: "none", stroke: luminance(ink) > 0.4 ? rim : PAPER, strokeWidth: detail === "full" ? 2.4 : 3 });
    }

    layers.push({ d, fill: ink });
  }

  layers.push({ d: shape.d, fill: "none", clip: true, stroke: rim, strokeWidth: detail === "minimal" ? 7 : 5 });

  if (detail === "full") {
    layers.push({ d: shapeInset(spec.shape, pattern.keyline ?? KEYLINE_INSET), fill: "none", stroke: spec.accent, strokeWidth: 1.1, opacity: 0.85 });
  }

  return layers;
}
