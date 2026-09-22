import { useMemo } from "react";
import { encodeQr } from "./qrCode";

const QUIET_ZONE = 4;

/** Renders locally as inline SVG; the encoded text never leaves the page. */
export function QrCode({ value, label, size = 184 }: { readonly value: string; readonly label: string; readonly size?: number }): React.JSX.Element {
  const { path, extent } = useMemo(() => {
    const matrix = encodeQr(value);
    let d = "";

    matrix.modules.forEach((row, y) => {
      row.forEach((dark, x) => {
        if (dark) d += `M${String(x + QUIET_ZONE)} ${String(y + QUIET_ZONE)}h1v1h-1z`;
      });
    });

    return { path: d, extent: matrix.size + QUIET_ZONE * 2 };
  }, [value]);

  return (
    <svg role="img" aria-label={label} width={size} height={size} viewBox={`0 0 ${String(extent)} ${String(extent)}`} shapeRendering="crispEdges" className="block rounded-sm bg-white">
      <path d={path} className="fill-black" />
    </svg>
  );
}
