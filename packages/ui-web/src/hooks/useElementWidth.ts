import { useLayoutEffect, useRef, useState } from "react";

export function useElementWidth<T extends HTMLElement>(): readonly [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const node = ref.current;

    if (node === null) return;

    setWidth(node.clientWidth);

    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width;

      if (next !== undefined) setWidth(Math.round(next));
    });

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, []);

  return [ref, width];
}
