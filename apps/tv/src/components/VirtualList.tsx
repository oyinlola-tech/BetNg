import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { offsetsOf, scrollToKeep, windowRange } from "../lib/virtual";

function remPx(): number {
  const size = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);

  return Number.isFinite(size) && size > 0 ? size : 16;
}

/* Only the rows in view are in the DOM. Heights are in rem so the list scales with the display. */
export function VirtualList<T>({
  items,
  keyOf,
  heightOf,
  render,
  anchor,
  label,
  className,
}: {
  readonly items: readonly T[];
  readonly keyOf: (item: T) => string;
  readonly heightOf: (item: T) => number;
  readonly render: (item: T, index: number) => React.ReactNode;
  readonly anchor?: number;
  readonly label: string;
  readonly className?: string;
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState(0);
  const [rem, setRem] = useState(16);

  useLayoutEffect(() => {
    const el = ref.current;

    if (el === null) return;

    const measure = (): void => {
      setRem(remPx());
      setViewport(el.clientHeight);
    };

    measure();

    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(measure);

    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, []);

  const heights = items.map((item) => heightOf(item) * rem);
  const view = viewport > 0 ? viewport : 1080;
  const { offsets, total } = offsetsOf(heights);
  const top = anchor === undefined ? 0 : scrollToKeep(offsets, heights, anchor, view, total);
  const range = windowRange(heights, top, view);

  useEffect(() => {
    if (ref.current !== null) ref.current.scrollTop = top;
  }, [top]);

  return (
    <div ref={ref} role="list" aria-label={label} className={cn("relative min-h-0 overflow-hidden", className)}>
      <div style={{ height: `${String(range.total)}px` }} className="relative">
        {items.slice(range.start, range.end).map((item, i) => {
          const index = range.start + i;

          return (
            <div key={keyOf(item)} role="listitem" className="absolute inset-x-0" style={{ top: `${String(range.offsets[index] ?? 0)}px`, height: `${String(heights[index] ?? 0)}px` }}>
              {render(item, index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
