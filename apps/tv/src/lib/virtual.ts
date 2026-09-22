export interface VirtualWindow {
  readonly start: number;
  readonly end: number;
  readonly offsets: readonly number[];
  readonly total: number;
}

export function offsetsOf(heights: readonly number[]): { readonly offsets: readonly number[]; readonly total: number } {
  const offsets: number[] = [];
  let total = 0;

  for (const h of heights) {
    offsets.push(total);
    total += h;
  }

  return { offsets, total };
}

/* The rows that intersect the viewport, plus an overscan either side. `end` is exclusive. */
export function windowRange(heights: readonly number[], scrollTop: number, viewport: number, overscan = 3): VirtualWindow {
  const { offsets, total } = offsetsOf(heights);
  const count = heights.length;
  let start = 0;

  while (start < count && (offsets[start] ?? 0) + (heights[start] ?? 0) <= scrollTop) start += 1;

  let end = start;

  while (end < count && (offsets[end] ?? 0) < scrollTop + viewport) end += 1;

  return { start: Math.max(0, start - overscan), end: Math.min(count, end + overscan), offsets, total };
}

export function scrollToKeep(offsets: readonly number[], heights: readonly number[], index: number, viewport: number, total: number): number {
  const top = offsets[index] ?? 0;
  const target = top - viewport / 3 + (heights[index] ?? 0) / 2;

  return Math.max(0, Math.min(Math.max(0, total - viewport), target));
}
