/**
 * BETNG's football icon set as geometry, so every client draws the same
 * glyphs: 24x24 viewBox, 1.75 stroke, round caps and joins, currentColor.
 * A primitive with `paint: "card"` is filled with the card's status colour.
 */

export type FootballIconPrimitive =
  | { readonly type: "path"; readonly d: string; readonly strokeWidth?: number; readonly strokeDasharray?: string }
  | { readonly type: "circle"; readonly cx: number; readonly cy: number; readonly r: number; readonly strokeWidth?: number }
  | {
      readonly type: "rect";
      readonly x: number;
      readonly y: number;
      readonly width: number;
      readonly height: number;
      readonly rx?: number;
      readonly transform?: string;
      readonly strokeWidth?: number;
      readonly paint?: "card";
    };

export const FOOTBALL_ICON_VIEWBOX = "0 0 24 24";
export const FOOTBALL_ICON_STROKE = 1.75;

export const FOOTBALL_ICONS = {
  corner: [
    { type: "path", d: "M5 21V3" },
    { type: "path", d: "M5 3.5l8.5 3-8.5 3" },
    { type: "path", d: "M5 21h16" },
    { type: "path", d: "M12.5 21A7.5 7.5 0 005 13.5" },
  ],
  football: [
    { type: "circle", cx: 12, cy: 12, r: 9 },
    { type: "path", d: "M12 8.4l3.42 2.49-1.3 4.02H9.88l-1.3-4.02z" },
    { type: "path", d: "M12 8.4V3M15.42 10.89l5.14-1.67M14.12 14.91l3.17 4.37M9.88 14.91l-3.17 4.37M8.58 10.89L3.44 9.22" },
  ],
  formation: [
    { type: "rect", x: 3.5, y: 2.5, width: 17, height: 19, rx: 1.5 },
    { type: "path", d: "M12 18h.01M7.5 13.6h.01M12 13.6h.01M16.5 13.6h.01M9.5 9.4h.01M14.5 9.4h.01M12 5.8h.01", strokeWidth: 2.4 },
  ],
  foul: [
    { type: "path", d: "M7 3.5l7.5 17" },
    { type: "path", d: "M3 16.5l12.5-5" },
    { type: "path", d: "M17.2 7.2l2.6-2.4M18.6 11.2h3.2M14.4 5.4l.6-3" },
  ],
  freeKick: [
    { type: "circle", cx: 5.5, cy: 17.5, r: 3 },
    { type: "path", d: "M12.5 10.5v10M16.5 10.5v10M20.5 10.5v10" },
    { type: "path", d: "M12.5 6.6h.01M16.5 6.6h.01M20.5 6.6h.01", strokeWidth: 2.4 },
  ],
  fullTime: [
    { type: "circle", cx: 12, cy: 13.5, r: 8 },
    { type: "path", d: "M10 2.5h4" },
    { type: "circle", cx: 12, cy: 13.5, r: 4.25 },
    { type: "path", d: "M12 13.5h.01", strokeWidth: 2.4 },
  ],
  goal: [
    { type: "path", d: "M3 20V5h18v15" },
    { type: "path", d: "M3 9.5h18M8 5v4.5M12 5v4.5M16 5v4.5" },
    { type: "circle", cx: 12, cy: 16, r: 3 },
  ],
  halfTime: [
    { type: "circle", cx: 12, cy: 13.5, r: 8 },
    { type: "path", d: "M10 2.5h4" },
    { type: "path", d: "M12 9a4.5 4.5 0 010 9z" },
  ],
  kickoff: [
    { type: "circle", cx: 12, cy: 12, r: 8 },
    { type: "circle", cx: 12, cy: 12, r: 2.4 },
    { type: "path", d: "M12 2v7.6M12 14.4V22" },
  ],
  offside: [
    { type: "path", d: "M5 21V3.5" },
    { type: "path", d: "M5 4h9.5v7.5H5" },
    { type: "path", d: "M9.75 4v7.5M5 7.75h9.5" },
    { type: "path", d: "M19.5 3v18", strokeDasharray: "2.2 3.2" },
  ],
  ownGoal: [
    { type: "path", d: "M3 20V5h18v15" },
    { type: "path", d: "M3 9.5h18" },
    { type: "circle", cx: 8.5, cy: 16.5, r: 2.5 },
    { type: "path", d: "M14 18.5h2.5a2.25 2.25 0 000-4.5H13.5" },
    { type: "path", d: "M15.3 12.2L13.5 14l1.8 1.8" },
  ],
  penalty: [
    { type: "path", d: "M5 8V2.5h14V8" },
    { type: "path", d: "M2.5 8h19" },
    { type: "circle", cx: 12, cy: 13.2, r: 2.3 },
    { type: "path", d: "M3 18.5h18" },
    { type: "path", d: "M8 18.5a4 3 0 008 0" },
  ],
  penaltyMissed: [
    { type: "path", d: "M3 8V2.5h11.5V8" },
    { type: "path", d: "M2 8h14.5" },
    { type: "path", d: "M17.8 3.2l3.6 3.6M21.4 3.2l-3.6 3.6" },
    { type: "circle", cx: 12, cy: 13.2, r: 2.3 },
    { type: "path", d: "M3 18.5h18" },
    { type: "path", d: "M8 18.5a4 3 0 008 0" },
  ],
  possession: [
    { type: "path", d: "M12 2.75a9.25 9.25 0 108.01 13.88" },
    { type: "circle", cx: 12, cy: 12, r: 4 },
  ],
  redCard: [
    { type: "rect", x: 7, y: 3.5, width: 10, height: 17, rx: 1.75, transform: "rotate(8 12 12)", paint: "card" },
  ],
  referee: [
    { type: "circle", cx: 9.5, cy: 5.2, r: 2.2 },
    { type: "path", d: "M9.5 8.6v7" },
    { type: "path", d: "M9.5 15.6l-3 5.9M9.5 15.6l3 5.9" },
    { type: "path", d: "M9.5 10.6l-3.7 3.2" },
    { type: "path", d: "M9.5 10.6l5.6-3.2" },
    { type: "rect", x: 14.6, y: 2, width: 4, height: 5.4, rx: 0.6 },
  ],
  shot: [
    { type: "circle", cx: 15.5, cy: 12, r: 5.5 },
    { type: "path", d: "M2.5 8h5M2 12h4M2.5 16h5" },
  ],
  shotOnTarget: [
    { type: "path", d: "M16.5 4H21v16h-4.5" },
    { type: "circle", cx: 13, cy: 12, r: 4 },
    { type: "path", d: "M2.5 9h4M2 12h3.5M2.5 15h4" },
  ],
  stadium: [
    { type: "path", d: "M3 20.5v-5.2l3.2-3h11.6l3.2 3v5.2" },
    { type: "path", d: "M2 20.5h20" },
    { type: "path", d: "M9.5 20.5v-3.7h5v3.7" },
    { type: "path", d: "M6 12.3V5M18 12.3V5" },
    { type: "path", d: "M4.2 4.2h3.6M16.2 4.2h3.6" },
  ],
  substitution: [
    { type: "path", d: "M8 20V5" },
    { type: "path", d: "M4 9l4-4 4 4" },
    { type: "path", d: "M16 4v15" },
    { type: "path", d: "M12 15l4 4 4-4" },
  ],
  var: [
    { type: "rect", x: 2.5, y: 4, width: 19, height: 13, rx: 2 },
    { type: "path", d: "M10.2 7.9v5.2l4.4-2.6z" },
    { type: "path", d: "M12 17v3.5M8 20.5h8" },
  ],
  whistle: [
    { type: "circle", cx: 9, cy: 14.5, r: 5.5 },
    { type: "path", d: "M9 9h12v4h-6.8" },
    { type: "path", d: "M9 14.5h.01" },
    { type: "path", d: "M4.2 5.6L3 4M8 4.6V2.6" },
  ],
  yellowCard: [
    { type: "rect", x: 7, y: 3.5, width: 10, height: 17, rx: 1.75, transform: "rotate(8 12 12)", paint: "card" },
  ],
} as const satisfies Record<string, readonly FootballIconPrimitive[]>;

export type FootballIconName = keyof typeof FOOTBALL_ICONS;

/** The glyph for each match event kind the platform reports. */
export const FOOTBALL_EVENT_ICON = {
  KICK_OFF: "kickoff",
  GOAL: "goal",
  OWN_GOAL: "ownGoal",
  PENALTY_GOAL: "penalty",
  PENALTY_MISSED: "penaltyMissed",
  VAR: "var",
  OFFSIDE: "offside",
  FOUL: "foul",
  FREE_KICK: "freeKick",
  YELLOW_CARD: "yellowCard",
  RED_CARD: "redCard",
  SUBSTITUTION: "substitution",
  CORNER: "corner",
  SHOT: "shot",
  HALF_TIME: "halfTime",
  SECOND_HALF: "kickoff",
  FULL_TIME: "fullTime",
} as const satisfies Record<string, FootballIconName>;

const attr = (name: string, value: string | number | undefined): string =>
  value === undefined ? "" : ` ${name}="${String(value)}"`;

/** One icon as an SVG string, for clients that do not render React DOM. `cardFill` paints a card glyph. */
export function footballIconSvg(
  name: FootballIconName,
  options: { readonly size?: number; readonly color?: string; readonly cardFill?: string } = {},
): string {
  const { size = 20, color = "currentColor", cardFill } = options;
  const body = FOOTBALL_ICONS[name]
    .map((p: FootballIconPrimitive) => {
      const stroke = attr("stroke-width", p.strokeWidth);

      if (p.type === "path") return `<path d="${p.d}"${stroke}${attr("stroke-dasharray", p.strokeDasharray)}/>`;
      if (p.type === "circle") return `<circle cx="${String(p.cx)}" cy="${String(p.cy)}" r="${String(p.r)}"${stroke}/>`;

      const fill = p.paint === "card" && cardFill !== undefined ? ` fill="${cardFill}" stroke="${cardFill}"` : "";

      return `<rect x="${String(p.x)}" y="${String(p.y)}" width="${String(p.width)}" height="${String(p.height)}"${attr("rx", p.rx)}${attr("transform", p.transform)}${stroke}${fill}/>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${String(size)}" height="${String(size)}" viewBox="${FOOTBALL_ICON_VIEWBOX}" fill="none" stroke="${color}" stroke-width="${String(FOOTBALL_ICON_STROKE)}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}
