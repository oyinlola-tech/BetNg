// Draws the README banner and the architecture diagrams as SVG, in light and dark variants.
import { mkdirSync, writeFileSync } from "node:fs";
import { LOGO_B_PATH, LOGO_CUT_PATH, LOGO_TILE_PATH, crestFor, crestSvg } from "../../packages/brand/dist/index.js";

const THEMES = {
  light: { bg: "#F5F3EE", surface: "#FDFCFA", sunken: "#ECE9E2", border: "#E3DFD6", strong: "#CBC5B8", text: "#14130F", secondary: "#4B4840", muted: "#696459", brand: "#2457F5", brandSubtle: "#EAF0FF", live: "#E3142E", success: "#0E7553", warning: "#9C5207", danger: "#C92A2A", py: "#3776AB", ts: "#3178C6" },
  dark: { bg: "#0A0C10", surface: "#12151B", sunken: "#0D1015", border: "#222732", strong: "#323946", text: "#F2F4F7", secondary: "#B2BAC6", muted: "#8690A0", brand: "#4C7DFF", brandSubtle: "#111B33", live: "#FF3D52", success: "#2FBF83", warning: "#F0B441", danger: "#F26D6D", py: "#5B9BD5", ts: "#5B9BE6" },
};

const SANS = "Inter, 'Segoe UI', Helvetica, Arial, sans-serif";
const DISPLAY = "Archivo, Inter, 'Segoe UI', Helvetica, Arial, sans-serif";
const MONO = "'JetBrains Mono', 'DejaVu Sans Mono', Menlo, Consolas, monospace";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

const text = (x, y, value, { size = 14, weight = 400, fill, anchor = "start", family = SANS, spacing } = {}) =>
  `<text x="${x}" y="${y}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${spacing === undefined ? "" : ` letter-spacing="${spacing}"`}>${esc(value)}</text>`;

function box(t, x, y, w, h, title, sub, { accent, fill = t.surface, dashed = false, center = true, mono } = {}) {
  const cx = center ? x + w / 2 : x + 16;
  const anchor = center ? "middle" : "start";
  const lines = sub === undefined ? [] : Array.isArray(sub) ? sub : [sub];
  const top = y + h / 2 - (lines.length * 17) / 2 + (lines.length === 0 ? 5 : -2);

  return [
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${fill}" stroke="${accent ?? t.border}" stroke-width="${accent === undefined ? 1 : 1.5}"${dashed ? ' stroke-dasharray="6 5"' : ""}/>`,
    accent === undefined ? "" : `<rect x="${x}" y="${y + 10}" width="3" height="${h - 20}" rx="1.5" fill="${accent}"/>`,
    text(cx, top, title, { size: 15, weight: 700, fill: t.text, anchor, family: DISPLAY }),
    ...lines.map((line, i) => text(cx, top + 19 + i * 17, line, { size: 12, fill: t.muted, anchor, family: mono === true ? MONO : SANS })),
  ].join("");
}

function arrow(t, x1, y1, x2, y2, { label, dashed = false, color, labelDx = 8, labelDy = 0, bend } = {}) {
  const stroke = color ?? t.strong;
  const d = bend === undefined ? `M${x1} ${y1} L${x2} ${y2}` : `M${x1} ${y1} C${bend[0]} ${bend[1]}, ${bend[2]} ${bend[3]}, ${x2} ${y2}`;
  const angle = Math.atan2(y2 - (bend === undefined ? y1 : bend[3]), x2 - (bend === undefined ? x1 : bend[2]));
  const head = [
    [x2, y2],
    [x2 - 9 * Math.cos(angle - 0.45), y2 - 9 * Math.sin(angle - 0.45)],
    [x2 - 9 * Math.cos(angle + 0.45), y2 - 9 * Math.sin(angle + 0.45)],
  ];

  return [
    `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="1.6"${dashed ? ' stroke-dasharray="5 5"' : ""}/>`,
    `<path d="M${head.map((p) => p.map((n) => n.toFixed(1)).join(" ")).join(" L")} Z" fill="${stroke}"/>`,
    label === undefined ? "" : text((x1 + x2) / 2 + labelDx, (y1 + y2) / 2 + labelDy, label, { size: 11, fill: t.muted, family: MONO }),
  ].join("");
}

const frame = (t, x, y, w, h, label, accent) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="${t.sunken}" stroke="${t.border}"/><rect x="${x + 18}" y="${y + 16}" width="3" height="13" fill="${accent ?? t.brand}"/>${text(x + 28, y + 27, label.toUpperCase(), { size: 11, weight: 700, fill: t.muted, spacing: 1.2 })}`;

const svg = (w, h, t, body, label) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}"><rect width="${w}" height="${h}" rx="16" fill="${t.bg}"/>${body}</svg>\n`;

function logo(x, y, size, t) {
  return `<g transform="translate(${x} ${y}) scale(${size / 64})"><path d="${LOGO_TILE_PATH}" fill="${t.brand}"/><path d="${LOGO_B_PATH}" fill="${t === THEMES.dark ? "#071230" : "#FFFFFF"}"/><path d="${LOGO_CUT_PATH}" fill="${t.brand}" opacity="0.92"/></g>`;
}

const DEMO_TEAMS = [
  ["banner-01", "#1F4E9C", "#F2C230"], ["banner-02", "#A3122A", "#FFFFFF"], ["banner-03", "#0E6B3A", "#F4F1E8"],
  ["banner-04", "#232323", "#E8B517"], ["banner-05", "#5B2A86", "#F2F2F2"], ["banner-06", "#0B7FAB", "#FFFFFF"],
  ["banner-07", "#C0561B", "#1B1B1B"], ["banner-08", "#7A1F2B", "#8DB9E8"],
];

function crest(id, primary, secondary, size) {
  const spec = crestFor({ id, colors: { primary, secondary } });

  return crestSvg(spec, size, { clipId: `c-${id}` }).replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
}

function banner(t) {
  const W = 1280;
  const H = 400;
  const crests = DEMO_TEAMS.map(([id, p, s], i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = 820 + col * 104;
    const y = 86 + row * 118;

    return `<g transform="translate(${x} ${y})"><rect x="-6" y="-6" width="92" height="104" rx="12" fill="${t.surface}" stroke="${t.border}"/><svg x="6" y="6" width="68" height="80" viewBox="0 0 64 64">${crest(id, p, s, 64)}</svg></g>`;
  }).join("");

  const body = [
    `<circle cx="${W - 330}" cy="${H / 2}" r="150" fill="none" stroke="${t.border}" stroke-width="1.5"/>`,
    `<line x1="${W - 330}" y1="0" x2="${W - 330}" y2="${H}" stroke="${t.border}" stroke-width="1.5"/>`,
    `<circle cx="${W - 330}" cy="${H / 2}" r="4" fill="${t.border}"/>`,
    logo(64, 72, 60, t),
    text(140, 118, "BET", { size: 50, weight: 800, fill: t.text, family: DISPLAY, spacing: -1 }),
    text(242, 118, "NG", { size: 50, weight: 800, fill: t.brand, family: DISPLAY, spacing: -1 }),
    `<rect x="64" y="162" width="3" height="16" fill="${t.brand}"/>`,
    text(76, 176, "PREMIUM FOOTBALL COMMAND CENTER", { size: 13, weight: 700, fill: t.muted, spacing: 1.6 }),
    text(64, 222, "A virtual football platform: one simulated match,", { size: 22, weight: 600, fill: t.text, family: DISPLAY }),
    text(64, 252, "seen the same way on web, mobile, TV, shop and admin.", { size: 22, weight: 600, fill: t.text, family: DISPLAY }),
    text(64, 300, "Play money only. Eleven services, five clients, one source of truth.", { size: 14, fill: t.secondary }),
    ...["Web", "Mobile", "TV", "Shop", "Admin"].map((label, i) =>
      `<rect x="${64 + i * 86}" y="326" width="78" height="30" rx="6" fill="${t.surface}" stroke="${t.border}"/>${text(103 + i * 86, 346, label, { size: 13, weight: 600, fill: t.text, anchor: "middle" })}`),
    crests,
  ].join("");

  return svg(W, H, t, body, "BETNG, a premium football command center");
}

function system(t) {
  const W = 1280;
  const H = 760;
  const clients = [["Web", ":4200 · React"], ["Mobile", "Expo · React Native"], ["TV", ":4300 · D-pad"], ["Shop", ":4400 · cashier"], ["Admin", ":4500 · control plane"]];
  const ts = [["match", "fixtures · lifecycle · scheduler"], ["betting", "bets · shop tickets"], ["wallet", "append-only ledger"], ["settlement", "operator ledger"], ["identity", "sessions · RBAC · audit"]];
  const py = [["simulation", "model · result · events"], ["odds", "markets · pricing"], ["risk", "exposure · limits"], ["analytics", "read-only reports"]];
  const parts = [frame(t, 24, 24, W - 48, 128, "Clients", t.brand)];

  clients.forEach(([name, sub], i) => parts.push(box(t, 48 + i * 244, 62, 220, 70, name, sub)));
  parts.push(frame(t, 24, 188, W - 48, 128, "Public edge", t.live));
  parts.push(box(t, 48, 226, 780, 70, "Gateway  /api/v1", ["authentication · RBAC · rate limits · rebuilds actor headers · strips forged ones"], { accent: t.brand }));
  parts.push(box(t, 852, 226, 380, 70, "Event service  WS /live", ["public match channels · sequence per channel"], { accent: t.live }));
  parts.push(frame(t, 24, 352, 700, 200, "TypeScript services · ZudoJS · Prisma", t.ts));
  ts.forEach(([name, sub], i) => parts.push(box(t, 48 + (i % 3) * 222, 392 + Math.floor(i / 3) * 80, 206, 66, name, sub)));
  parts.push(frame(t, 744, 352, 512, 200, "Python services · FastAPI · Pydantic", t.py));
  py.forEach(([name, sub], i) => parts.push(box(t, 768 + (i % 2) * 238, 392 + Math.floor(i / 2) * 80, 222, 66, name, sub)));
  parts.push(frame(t, 24, 588, W - 48, 148, "Storage", t.success));
  parts.push(box(t, 48, 626, 780, 86, "PostgreSQL 17  ·  database betng", ["one schema and one login per owning service; a service writes only its own schema", "money in BIGINT kobo · results immutable by trigger · append-only ledgers"], { accent: t.success }));
  parts.push(box(t, 852, 626, 380, 86, "Redis 8", ["scheduler lock · session cache · rate-limit counters", "no persistence; never authoritative"], { accent: t.success }));

  parts.push(arrow(t, 438, 152, 438, 226, { label: "HTTPS  /api/v1", color: t.brand }));
  parts.push(arrow(t, 1042, 152, 1042, 226, { label: "WS  /live", dashed: true, color: t.live }));
  parts.push(arrow(t, 374, 296, 374, 352, { label: "REST, same path" }));
  parts.push(arrow(t, 700, 296, 900, 352, { label: "REST", labelDx: 14, labelDy: 4 }));
  parts.push(arrow(t, 640, 352, 900, 296, { dashed: true, color: t.live, bend: [660, 322, 880, 330] }));
  parts.push(text(770, 346, "revealed events", { size: 11, fill: t.muted, family: MONO }));
  parts.push(arrow(t, 722, 470, 746, 470, { color: t.brand }));
  parts.push(arrow(t, 746, 486, 722, 486, { color: t.brand }));
  parts.push(text(734, 510, "RPC", { size: 11, weight: 700, fill: t.brand, family: MONO, anchor: "middle" }));
  parts.push(text(640, 576, "services call each other only through POST /rpc with the internal token", { size: 11, fill: t.muted, family: MONO, anchor: "middle" }));
  parts.push(arrow(t, 374, 552, 374, 626));
  parts.push(arrow(t, 790, 552, 740, 626));
  parts.push(arrow(t, 1042, 552, 1042, 626));

  return svg(W, H, t, parts.join(""), "BETNG system: clients, public edge, services and storage");
}

function frontendLayers(t) {
  const W = 1280;
  const H = 700;
  const steps = [
    ["UI component", "renders view models · no fetch, no URLs, no SDK", "apps/*/src/pages, packages/ui-web"],
    ["Feature hook", "TanStack Query keys, stale times, invalidation", "apps/*/src/hooks"],
    ["Application service", "placeBet(), session, runtime bootstrap", "apps/*/src/services"],
    ["Data source interface", "BetNgDataSource · AuthDataSource · ShopDataSource · AdminDataSource", "packages/ui-core"],
    ["Platform adapter", "wire contract → view model · one error model", "packages/ui-core/src/adapters"],
    ["SDK", "REST requester · realtime client", "packages/client-sdk"],
  ];
  const parts = [];

  steps.forEach(([title, sub, where], i) => {
    const y = 36 + i * 96;

    parts.push(box(t, 48, y, 720, 72, title, [sub, where], { accent: i === 4 ? t.brand : undefined, center: false }));
    if (i < steps.length - 1) parts.push(arrow(t, 408, y + 72, 408, y + 96));
  });

  parts.push(arrow(t, 408, 36 + 5 * 96 + 72, 408, 36 + 6 * 96));
  parts.push(box(t, 48, 36 + 6 * 96, 720, 60, "Public gateway  /api/v1   ·   WS /live", undefined, { accent: t.live }));
  parts.push(box(t, 820, 36 + 4 * 96 - 6, 412, 84, "Development stand-in", ["packages/mock-data, same interfaces", "dynamic import, development and test only", "absent from staging and production bundles"], { dashed: true, center: false }));
  parts.push(arrow(t, 820, 36 + 4 * 96 + 36, 770, 36 + 4 * 96 + 36, { dashed: true }));
  parts.push(frame(t, 820, 36, 412, 300, "The platform decides", t.success));
  ["match state, phase and clock", "results, odds, market status", "bet acceptance and payouts", "wallet balances", "risk decisions, operator figures", "roles and permissions"].forEach((line, i) =>
    parts.push(`<circle cx="848" cy="${96 + i * 38}" r="4" fill="${t.success}"/>${text(864, 100 + i * 38, line, { size: 14, fill: t.text })}`));

  return svg(W, H, t, parts.join(""), "Frontend layers from component to gateway");
}

function realtime(t) {
  const W = 1280;
  const H = 520;
  const row = [
    ["Event service", "WS /live"],
    ["Transport", "WebSocket | SSE"],
    ["ConnectionManager", "status · backoff · replace"],
    ["RealtimeClient", "frames · PING/PONG · auth"],
    ["EventRouter", "dedupe · order · gaps"],
  ];
  const parts = [];

  row.forEach(([title, sub], i) => {
    parts.push(box(t, 36 + i * 246, 44, 214, 76, title, sub, { accent: i === 0 ? t.live : undefined }));
    if (i < row.length - 1) parts.push(arrow(t, 250 + i * 246, 82, 282 + i * 246, 82));
  });

  parts.push(box(t, 1020, 200, 214, 76, "SubscriptionManager", "reference-counted channels"));
  parts.push(arrow(t, 1127, 200, 1127, 120, { dashed: true }));
  parts.push(box(t, 282, 200, 460, 76, "Platform data source", "timeline events · lifecycle signals · connection state", { accent: t.brand }));
  parts.push(arrow(t, 1020, 110, 742, 214, { bend: [900, 150, 800, 200] }));
  parts.push(box(t, 36, 350, 330, 96, "watchMatch", ["appends timeline events in sequence", "re-reads on gap, signal, full time, reconnect"]));
  parts.push(box(t, 410, 350, 330, 96, "Query invalidation", ["odds, bets, wallet re-read", "never patched from a frame"]));
  parts.push(box(t, 784, 350, 450, 96, "UI", ["ConnectionStrip: reconnecting · connection lost · last updated", "stale marker on live widgets while disconnected"], { accent: t.success }));
  parts.push(arrow(t, 400, 276, 250, 350));
  parts.push(arrow(t, 560, 276, 575, 350));
  parts.push(arrow(t, 366, 398, 410, 398));
  parts.push(arrow(t, 740, 398, 784, 398));
  parts.push(text(640, 490, "The stream is a projection. Any doubt is resolved by reading the authoritative match over REST.", { size: 13, fill: t.muted, anchor: "middle" }));

  return svg(W, H, t, parts.join(""), "Realtime pipeline from the event service to the UI");
}

function lifecycle(t) {
  const W = 1280;
  const H = 470;
  const states = [
    ["FIXTURE_CREATED", "SCHEDULED"], ["MARKETS_CREATED", "SCHEDULED"], ["ODDS_PUBLISHED", "SCHEDULED"], ["BETTING_OPEN", "BETTING_OPEN"],
    ["BETTING_ACTIVE", "BETTING_OPEN"], ["BETTING_CLOSED", "BETTING_CLOSED"], ["SIMULATION_STARTED", "BETTING_CLOSED"], ["RESULT_GENERATED", "IN_PLAY"],
    ["EVENTS_PUBLISHED", "IN_PLAY"], ["MATCH_FINISHED", "COMPLETED"], ["SETTLEMENT_STARTED", "COMPLETED"], ["SETTLEMENT_COMPLETED", "COMPLETED"],
  ];
  const tone = { SCHEDULED: t.muted, BETTING_OPEN: t.brand, BETTING_CLOSED: t.warning, IN_PLAY: t.live, COMPLETED: t.success };
  const parts = [text(40, 40, "lifecycle (canonical)  →  public status", { size: 12, fill: t.muted, family: MONO })];
  const bw = 186;
  const gx = 14;

  states.forEach(([state, status], i) => {
    const col = i % 6;
    const row = Math.floor(i / 6);
    const x = 40 + (row === 0 ? col : 5 - col) * (bw + gx);
    const y = 64 + row * 150;

    parts.push(`<rect x="${x}" y="${y}" width="${bw}" height="76" rx="10" fill="${t.surface}" stroke="${t.border}"/><rect x="${x}" y="${y + 66}" width="${bw}" height="10" rx="0" fill="${tone[status]}" opacity="0.9"/>`);
    parts.push(text(x + bw / 2, y + 30, state, { size: 12, weight: 700, fill: t.text, anchor: "middle", family: MONO }));
    parts.push(text(x + bw / 2, y + 52, status, { size: 11, fill: tone[status], anchor: "middle", family: MONO, weight: 600 }));

    if (i === 5) parts.push(arrow(t, x + bw / 2, y + 76, x + bw / 2, y + 150));
    else if (i < 11) parts.push(row === 0 ? arrow(t, x + bw, y + 38, x + bw + gx, y + 38) : arrow(t, x, y + 38, x - gx, y + 38));
  });

  const failures = [["SIMULATION_FAILED", "retried with backoff, then an admin retry"], ["SETTLEMENT_FAILED", "retried with backoff"], ["VOIDED", "admin void · stakes refunded · audited"]];

  failures.forEach(([state, note], i) => {
    const x = 40 + i * 400;

    parts.push(`<rect x="${x}" y="360" width="380" height="64" rx="10" fill="${t.surface}" stroke="${t.danger}" stroke-dasharray="6 5"/>`);
    parts.push(text(x + 18, 386, state, { size: 12, weight: 700, fill: t.danger, family: MONO }));
    parts.push(text(x + 18, 408, note, { size: 12, fill: t.muted }));
  });

  parts.push(text(1240, 452, "A result, once committed, is immutable; admins cannot set a score or pick a winner.", { size: 12, fill: t.muted, anchor: "end" }));

  return svg(W, H, t, parts.join(""), "Match lifecycle and its public status");
}

for (const [name, t] of Object.entries(THEMES)) {
  writeFileSync(`docs/images/brand/banner-${name}.svg`, banner(t));
  writeFileSync(`docs/images/diagrams/system-${name}.svg`, system(t));
  writeFileSync(`docs/images/diagrams/frontend-layers-${name}.svg`, frontendLayers(t));
  writeFileSync(`docs/images/diagrams/realtime-${name}.svg`, realtime(t));
  writeFileSync(`docs/images/diagrams/lifecycle-${name}.svg`, lifecycle(t));
}

console.log("banner and diagrams written");

// Badges carry numbers from the latest recorded runs; update them with the proof images.
const BADGES = [
  ["licence", "licence", "MIT", "#2457F5"],
  ["play-money", "money", "play money only", "#9C5207"],
  ["platform-tests", "platform tests", "1,578 passing", "#0E7553"],
  ["frontend-tests", "frontend tests", "641 passing", "#0E7553"],
  ["scenario", "end-to-end scenario", "22 / 22 steps", "#0E7553"],
  ["typescript", "TypeScript", "7", "#3178C6"],
  ["python", "Python", "3.14", "#3776AB"],
  ["node", "Node.js", "24", "#5FA04E"],
];

const width = (s) => Math.round([...s].reduce((w, ch) => w + (/[A-Z0-9]/.test(ch) ? 7.4 : ch === " " ? 3.4 : 6.4), 0)) + 20;

for (const [file, label, value, color] of BADGES) {
  const lw = width(label);
  const vw = width(value);
  const w = lw + vw;
  const badge = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="24" viewBox="0 0 ${w} 24" role="img" aria-label="${esc(label)}: ${esc(value)}"><rect width="${w}" height="24" rx="5" fill="#14130F"/><rect x="${lw}" width="${vw}" height="24" rx="5" fill="${color}"/><rect x="${lw}" width="6" height="24" fill="${color}"/><text x="${lw / 2}" y="16" text-anchor="middle" font-family="${SANS}" font-size="12" font-weight="600" fill="#F2F4F7">${esc(label)}</text><text x="${lw + vw / 2}" y="16" text-anchor="middle" font-family="${SANS}" font-size="12" font-weight="700" fill="#FFFFFF">${esc(value)}</text></svg>\n`;

  mkdirSync("docs/images/badges", { recursive: true });
  writeFileSync(`docs/images/badges/${file}.svg`, badge);
}
