import { crestLayers } from "./layers.js";
import { CREST_VIEWBOX, shapePath } from "./shapes.js";
import { detailFor } from "./spec.js";
import type { CrestLayer, CrestSpec } from "./types.js";

export interface CrestSvgOptions {
  readonly title?: string;
  readonly clipId?: string;
}

export function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${String(c.charCodeAt(0))};`);
}

export function layerMarkup(layer: CrestLayer, clipId: string): string {
  const attrs = [`d="${layer.d}"`, `fill="${escapeXml(layer.fill)}"`];

  if (layer.stroke !== undefined) attrs.push(`stroke="${escapeXml(layer.stroke)}"`, `stroke-width="${String(layer.strokeWidth ?? 1)}"`, 'stroke-linejoin="round"');
  if (layer.opacity !== undefined) attrs.push(`opacity="${String(layer.opacity)}"`);
  if (layer.clip === true) attrs.push(`clip-path="url(#${clipId})"`);

  return `<path ${attrs.join(" ")}/>`;
}

export function crestSvg(spec: CrestSpec, size = 48, options: CrestSvgOptions = {}): string {
  const clipId = escapeXml(options.clipId ?? `bn-crest-${spec.shape}`);
  const px = String(Math.max(1, Math.round(size)));
  const a11y = options.title === undefined ? 'aria-hidden="true"' : `role="img" aria-label="${escapeXml(options.title)}"`;
  const body = crestLayers(spec, detailFor(size))
    .map((layer) => layerMarkup(layer, clipId))
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="${CREST_VIEWBOX}" ${a11y}><defs><clipPath id="${clipId}"><path d="${shapePath(spec.shape)}"/></clipPath></defs>${body}</svg>`;
}
