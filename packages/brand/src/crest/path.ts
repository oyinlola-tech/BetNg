const ARITY: Readonly<Record<string, number>> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
const TOKEN = /([MLHVCSQTAZ])|(-?\d*\.?\d+(?:e-?\d+)?)/gi;

function fmt(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/** Uniform scale then translate. Handles absolute and relative commands. */
export function transformPath(d: string, scale: number, tx: number, ty: number): string {
  let out = "";
  let cmd = "";
  let args: number[] = [];

  const flush = (): void => {
    if (cmd === "") return;
    const upper = cmd.toUpperCase();
    const abs = cmd === upper;
    const n = ARITY[upper] ?? 0;

    if (n === 0) {
      out += cmd;

      return;
    }

    for (let i = 0; i + n <= args.length; i += n) {
      const part = args.slice(i, i + n).map((v, k) => {
        if (upper === "A") {
          if (k === 2 || k === 3 || k === 4) return v;
          if (k < 2) return v * scale;

          return v * scale + (abs ? (k === 5 ? tx : ty) : 0);
        }

        const isY = upper === "V" || (upper !== "H" && k % 2 === 1);

        return v * scale + (abs ? (isY ? ty : tx) : 0);
      });

      out += (i === 0 ? cmd : " ") + part.map(fmt).join(" ");
    }
  };

  for (const match of d.matchAll(TOKEN)) {
    if (match[1] !== undefined) {
      flush();
      cmd = match[1];
      args = [];
    } else if (match[2] !== undefined) {
      args.push(Number(match[2]));
    }
  }

  flush();

  return out;
}

export function scaleAbout(d: string, scale: number, cx: number, cy: number): string {
  return transformPath(d, scale, cx - cx * scale, cy - cy * scale);
}
