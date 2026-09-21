// Reads the public platform through the same adapter the clients use. Usage: VITE_API_URL=… VITE_WS_URL=… node scripts/smoke-platform.mjs
import { readClientEnv, createPlatformClients, createPlatformDataSource, createLogger, displayClock } from "../packages/ui-core/dist/index.js";

const env = readClientEnv({ VITE_APP_ENV: "test", VITE_DATA_SOURCE: "platform", VITE_API_URL: process.env.VITE_API_URL ?? "http://localhost:3000", VITE_WS_URL: process.env.VITE_WS_URL ?? "ws://localhost:3008/live" });
const failures = [];
const logger = createLogger({ minLevel: "warn", sinks: [(e) => failures.push(`${e.message} ${JSON.stringify(e.context ?? {})}`)] });
const { rest, realtime } = createPlatformClients({ env, getToken: () => undefined, onUnauthorized: () => undefined, logger });
const source = createPlatformDataSource({ rest, realtime, userId: () => undefined });
const step = async (name, run) => {
  try {
    console.log(`ok   ${name}:`, await run());
  } catch (error) {
    console.log(`FAIL ${name}: ${error.code ?? error.name} ${error.message}`);
  }
};

await step("config", async () => (await source.getPlatformConfig()).currency.code);
const leagues = await source.listLeagues().catch(() => []);
await step("leagues", async () => leagues.map((l) => l.code).join(","));
const matches = await source.listMatches({ limit: 50 }).catch((e) => (console.log("FAIL listMatches", e.code, e.message), []));
await step("matches", async () => `${matches.length} · phases ${[...new Set(matches.map((m) => m.phase))].join(",")}`);
const live = matches.find((m) => m.phase === "LIVE" || m.phase === "HALFTIME") ?? matches[0];

if (live !== undefined) {
  await step("match", async () => {
    const m = await source.getMatch(live.id);

    return `${m.home.name} ${m.score.home}-${m.score.away} ${m.away.name} · ${m.phase} · clock ${JSON.stringify(displayClock(m.clock) ?? null)} · events ${m.events.length} · lifecycle ${m.lifecycle}`;
  });
  await step("markets", async () => (await source.getMatchMarkets(live.id)).markets.map((m) => `${m.kind}:${m.status}`).slice(0, 6).join(" "));
  await step("lineups", async () => (await source.getMatchLineups(live.id)).confirmed);
  await step("h2h", async () => (await source.getHeadToHead(live.id)).played);

  const seen = [];
  const sub = source.subscribeMatch(live.id, { onEvent: (e) => seen.push(e.kind), onSignal: (s) => seen.push(`signal:${s}`), onConnection: (c) => seen.push(`conn:${c}`) });

  await new Promise((r) => setTimeout(r, 6000));
  sub.unsubscribe();
  console.log("ok   realtime (6s):", seen.join(" "));
}

if (leagues[0] !== undefined) await step("standings", async () => (await source.getStandings(leagues[0].id)).rows.length);
await step("search", async () => (await source.search({ term: "ar" })).hits.length);
realtime.close();
console.log("logged failures:", failures.length, failures.slice(0, 6));
process.exit(0);
