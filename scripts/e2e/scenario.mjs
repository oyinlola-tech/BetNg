// The end-to-end scenario: one match, many accounts, one result, one settlement, one operator ledger.
// Runs the real services (scripts/e2e/stack.mjs) on a throwaway database with a fast match clock.
//   node scripts/e2e/scenario.mjs

import { createHmac } from "node:crypto";
import assert from "node:assert/strict";
import { psql, resetDatabase, stackEnv, startStack, url } from "./stack.mjs";

const API = `${url("gateway")}/api/v1`;
const SEED_TOTP_SECRET = "BETNGDEVSEEDTOTPSECRET234567AAAA";

let step = 0;
const done = (text) => console.log(`  ${String(++step).padStart(2, " ")}. ${text}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function totp(secret, at = Date.now()) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";

  for (const char of secret) bits += alphabet.indexOf(char).toString(2).padStart(5, "0");

  const key = Buffer.from(bits.match(/.{8}/g).map((byte) => parseInt(byte, 2)));
  const counter = Buffer.alloc(8);

  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30000)));

  const digest = createHmac("sha1", key).update(counter).digest();
  const offset = digest[digest.length - 1] & 0xf;

  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

async function call(method, path, { token, body, headers = {}, base = API } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  const text = await response.text();

  return { status: response.status, data: text === "" ? undefined : JSON.parse(text) };
}

async function ok(method, path, options) {
  const response = await call(method, path, options);

  assert.ok(response.status < 300, `${method} ${path} → ${response.status} ${JSON.stringify(response.data)}`);

  return response.data;
}

async function rpc(service, procedure, payload, withToken = true) {
  const response = await fetch(`${url(service)}/rpc`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(withToken ? { "x-betng-internal-token": stackEnv().INTERNAL_SERVICE_TOKEN } : {}),
    },
    body: JSON.stringify({ id: crypto.randomUUID(), procedure, payload, metadata: {}, timestamp: Date.now() }),
  });

  return { status: response.status, body: await response.json() };
}

async function until(label, probe, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    const value = await probe();

    if (value) return value;
    if (Date.now() > deadline) throw new Error(`Timed out waiting for: ${label}`);

    await sleep(250);
  }
}

const count = (sql) => Number(psql(sql));

function legOutcome(code, home, away) {
  const winner = home > away ? "HOME" : home < away ? "AWAY" : "DRAW";

  return code === winner ? "WON" : "LOST";
}

async function scenario() {
  // 1–2. Admin creates a league and its teams.
  const admin = await ok("POST", "/admin/auth/login", {
    body: { email: "ops@betng.test", password: "betng-admin", code: totp(SEED_TOTP_SECRET) },
  });

  assert.equal(admin.admin.role, "SUPER_ADMIN");

  const league = await ok("POST", "/admin/leagues", {
    token: admin.token,
    body: { name: "E2E Cup", code: "E2E", slug: "e2e-cup", country: "Nigeria" },
  });

  done(`admin created league ${league.name}`);

  const ratings = (attack) => ({ attack, midfield: 70, defence: 68, goalkeeper: 70, pace: 72, finishing: attack, form: 0 });

  const home = await ok("POST", "/admin/teams", {
    token: admin.token,
    body: { leagueId: league.id, name: "Lagos Lions", shortName: "Lions", code: "LAL", ratings: ratings(82) },
  });

  const away = await ok("POST", "/admin/teams", {
    token: admin.token,
    body: { leagueId: league.id, name: "Abuja Eagles", shortName: "Eagles", code: "ABE", ratings: ratings(74) },
  });

  done(`admin created teams ${home.name} and ${away.name}`);

  // 3–4. The scheduler has created fixtures and matches for the seeded leagues.
  const scheduled = await until("scheduler fixtures", async () => {
    const to = new Date(Date.now() + 2 * 3_600_000).toISOString();
    const { items } = await ok("GET", `/fixtures?limit=500&to=${encodeURIComponent(to)}`);

    return items.length >= 40 ? items : undefined;
  });

  done(`scheduler created ${scheduled.length} fixtures, each with a match`);

  const fixture = await ok("POST", "/admin/fixtures", {
    token: admin.token,
    body: { leagueId: league.id, homeTeamId: home.id, awayTeamId: away.id, kickoffAt: new Date(Date.now() + 30_000).toISOString() },
  });

  const matchId = fixture.matchId ?? fixture.id;

  done(`match service created match ${matchId}`);

  // 5–6. The odds service publishes markets and the match opens.
  await until("betting open", async () => (await ok("GET", `/matches/${matchId}`)).status === "BETTING_OPEN");

  const odds = await ok("GET", `/matches/${matchId}/odds`);

  assert.equal(odds.markets.length, 8);
  assert.ok(odds.markets.every((market) => market.status === "OPEN" && market.oddsVersion === 1));
  done(`odds service published ${odds.markets.length} markets at version 1; betting is open`);

  // 7–11. Every kind of account loads the same match.
  const login = async (email) => (await ok("POST", "/auth/login", { body: { email, password: "betng-demo" } }));
  const customerA = await login("demo@betng.test");
  const customerB = await login("amaka@betng.test");
  const customerC = await login("segun@betng.test");

  const newEmail = `e2e-${Date.now()}@betng.test`;

  await ok("POST", "/auth/register", { body: { email: newEmail, password: "e2e-password-1", displayName: "E2E Customer" } });
  const customerD = await ok("POST", "/auth/verify", { body: { email: newEmail, code: stackEnv().DEV_VERIFICATION_CODE } });

  const shopLogin = async (shopCode, username, pin) =>
    ok("POST", "/shop/auth/login", { body: { shopCode, username, password: "betng-demo", pin } });

  const cashier1 = await shopLogin("BNG-LAG-001", "bisi", "1234");
  const cashier2 = await shopLogin("BNG-ABJ-001", "amina", "4321");

  const viewers = {
    "customer A": customerA.token,
    "customer B": customerB.token,
    "shop 1 cashier": cashier1.token,
    "shop 2 cashier": cashier2.token,
    TV: undefined,
  };

  const views = {};

  for (const [name, token] of Object.entries(viewers)) {
    views[name] = {
      match: await ok("GET", `/matches/${matchId}`, { token }),
      odds: await ok("GET", `/matches/${matchId}/odds`, { token }),
    };
  }

  const adminView = await ok("GET", `/admin/matches/${matchId}`, { token: admin.token });
  const fingerprint = (view) =>
    JSON.stringify({
      id: view.match.id,
      fixtureId: view.match.fixtureId,
      markets: view.odds.markets.map((m) => [m.id, m.oddsVersion, m.selections.map((s) => [s.id, s.odds])]),
    });

  const reference = fingerprint(views.TV);

  for (const [name, view] of Object.entries(views)) assert.equal(fingerprint(view), reference, `${name} sees a different match`);

  assert.equal(adminView.matchId ?? adminView.id, matchId);
  done("customer A, customer B, both shops, TV and admin load the same match_id, markets, odds and odds version");

  // 12–16. Bets from many accounts, each evaluated by risk against global exposure, each stored with its odds snapshot.
  const result1x2 = odds.markets.find((market) => market.type === "MATCH_RESULT");
  const pick = (code) => {
    const selection = result1x2.selections.find((s) => s.code === code);

    return { matchId, marketId: result1x2.id, selectionId: selection.id, odds: selection.odds };
  };

  const forged = await call("POST", "/bets", { token: customerA.token, body: { selections: [{ ...pick("HOME"), odds: 99 }], stake: 50_000 } });

  assert.equal(forged.status, 409);
  assert.equal(forged.data.error.code, "ODDS_CHANGED");
  assert.equal(forged.data.error.data.current[0].odds, pick("HOME").odds);

  const huge = await call("POST", "/bets", { token: customerA.token, body: { selections: [pick("HOME")], stake: 900_000_000 } });

  assert.equal(huge.status, 409);
  assert.equal(huge.data.error.code, "STAKE_LIMITED");
  assert.ok(huge.data.error.data.maxStake > 0);

  const adminBet = await call("POST", "/bets", { token: admin.token, body: { selections: [pick("HOME")], stake: 50_000 } });

  assert.equal(adminBet.status, 403, "an admin must never be able to bet");

  const placed = [];
  const bet = async (who, token, code, stake) => {
    const created = await ok("POST", "/bets", { token, body: { selections: [pick(code)], stake } });

    assert.equal(created.selections[0].matchId, matchId);
    assert.equal(created.selections[0].oddsVersion, 1);
    placed.push({ who, kind: "bet", id: created.id, code, stake, odds: created.selections[0].odds, potentialPayout: created.potentialPayout, token });
  };

  const ticket = async (who, token, code, stake) => {
    const created = await ok("POST", "/shop/tickets", { token, body: { selections: [pick(code)], stake, customerName: "Walk-in" } });

    placed.push({ who, kind: "ticket", id: created.id, ticketCode: created.code, code, stake, odds: created.selections[0].odds, potentialPayout: created.potentialPayout, token });
  };

  await bet("customer A", customerA.token, "HOME", 50_000);
  await bet("customer B", customerB.token, "HOME", 100_000);
  await bet("customer C", customerC.token, "DRAW", 70_000);
  await bet("customer D", customerD.token, "AWAY", 40_000);
  await ticket("shop 1", cashier1.token, "HOME", 200_000);
  await ticket("shop 2", cashier2.token, "AWAY", 150_000);

  done("customers A–D placed bets and two shops sold tickets on the same match (forged odds, an over-limit stake and an admin bet were refused)");

  const totalStake = placed.reduce((sum, p) => sum + p.stake, 0);
  const homeStake = placed.filter((p) => p.code === "HOME").reduce((sum, p) => sum + p.stake, 0);

  assert.equal(count(`SELECT count(*) FROM betting.bets b JOIN betting.bet_selections s ON s.bet_id = b.id WHERE s.match_id = '${matchId}'`), 6);
  assert.equal(count(`SELECT count(*) FROM risk.risk_decisions WHERE decision = 'ACCEPT' AND legs::text LIKE '%${matchId}%'`), 6);

  const exposure = (await ok("GET", "/admin/risk/exposure", { token: admin.token })).items.find((item) => item.matchId === matchId);
  const homeRow = exposure.markets.flatMap((m) => m.selections).find((s) => s.selectionId === pick("HOME").selectionId);

  assert.equal(exposure.totalStake, totalStake);
  assert.equal(homeRow.totalStake, homeStake);
  assert.equal(homeRow.bets, 3);
  done(`risk evaluated every bet against global exposure: HOME carries ₦${homeStake / 100} from 3 accounts, the match ₦${totalStake / 100}`);

  // 17–18. Betting closes; exposure is frozen.
  await until("betting closed", async () => (await ok("GET", `/matches/${matchId}`)).status !== "BETTING_OPEN");

  const late = await call("POST", "/bets", { token: customerA.token, body: { selections: [pick("DRAW")], stake: 50_000 } });

  assert.equal(late.status, 409);
  assert.equal(late.data.error.code, "MARKET_CLOSED");
  await until("exposure freeze", async () => count(`SELECT count(*) FROM risk.exposure_freezes WHERE match_id = '${matchId}'`) === 1);
  done("betting closed, a late bet was refused, and the exposure snapshot was frozen");

  // 19–23. One simulation, one result, one timeline, revealed over the match.
  await until("kick-off", async () => (await ok("GET", `/matches/${matchId}`)).status === "IN_PLAY");

  const liveRuns = (await ok("GET", "/admin/simulations", { token: admin.token })).items.filter((run) => run.matchId === matchId);

  assert.equal(liveRuns.length, 1);
  assert.equal(liveRuns[0].score, null, "a result must not be visible before full time");
  assert.equal(liveRuns[0].seed, null, "a seed must not be visible before full time");

  const stored = count(`SELECT count(*) FROM simulation.match_events WHERE match_id = '${matchId}'`);
  const revealedMidMatch = (await ok("GET", `/matches/${matchId}/events`)).items.length;

  assert.ok(revealedMidMatch < stored, "the whole timeline was revealed at kick-off");
  done(`simulation ran once at kick-off; ${revealedMidMatch} of ${stored} events revealed so far and the result is hidden from everyone`);

  const finished = await until("full time", async () => {
    const match = await ok("GET", `/matches/${matchId}`);

    return match.status === "COMPLETED" ? match : undefined;
  });

  const [homeGoals, awayGoals, winner, gap] = psql(
    `SELECT home_goals, away_goals, winner, winning_gap FROM simulation.match_results WHERE match_id = '${matchId}'`,
  ).split("|");

  assert.equal(count(`SELECT count(*) FROM simulation.simulation_runs WHERE match_id = '${matchId}'`), 1);
  assert.equal(count(`SELECT count(*) FROM simulation.match_results WHERE match_id = '${matchId}'`), 1);
  assert.deepEqual(finished.score, { home: Number(homeGoals), away: Number(awayGoals) });
  assert.equal(Number(gap), Math.abs(homeGoals - awayGoals));
  assert.equal(winner, homeGoals > awayGoals ? "HOME" : homeGoals < awayGoals ? "AWAY" : "DRAW");
  done(`match finished ${homeGoals}-${awayGoals}: winner ${winner}, winning gap ${gap} — one run, one result`);

  const timelines = [];

  for (const token of [customerA.token, customerB.token, cashier1.token, undefined]) {
    timelines.push(JSON.stringify((await ok("GET", `/matches/${matchId}/events`, { token })).items));
  }

  assert.ok(timelines.every((timeline) => timeline === timelines[0]));
  assert.equal(JSON.parse(timelines[0]).length, stored);
  assert.equal(JSON.parse(timelines[0]).filter((event) => event.type === "GOAL").length, Number(homeGoals) + Number(awayGoals));
  done(`every viewer receives the same ${stored}-event timeline, consistent with the score`);

  // 24–27. Settlement, wallets, operator ledger, commission.
  await until("settlement", async () => (await ok("GET", `/matches/${matchId}`)).lifecycle === "SETTLEMENT_COMPLETED");

  let payouts = 0;

  for (const entry of placed) {
    const expected = legOutcome(entry.code, Number(homeGoals), Number(awayGoals));
    const payout = expected === "WON" ? entry.potentialPayout : 0;

    payouts += payout;

    if (entry.kind === "bet") {
      const settled = await ok("GET", `/bets/${entry.id}`, { token: entry.token });

      assert.equal(settled.status, expected, `${entry.who} bet`);
      assert.equal(settled.payout ?? 0, payout);
      assert.equal(settled.selections[0].odds, entry.odds, "settlement must use the odds stored on the bet");

      const wallet = await ok("GET", "/wallets/me", { token: entry.token });

      assert.equal(wallet.balance, 10_000_000 - entry.stake + payout, `${entry.who} wallet`);
    } else {
      const settled = await ok("GET", `/shop/tickets/${entry.ticketCode}`, { token: entry.token });

      assert.equal(settled.status, expected, `${entry.who} ticket`);
    }
  }

  assert.equal(count(`SELECT count(*) FROM settlement.settlements s JOIN betting.bet_selections l ON l.bet_id = s.bet_id WHERE l.match_id = '${matchId}'`), 6);
  done("settlement evaluated all 6 accepted bets from the stored odds; customer wallets match stake and payout exactly");

  const operator = await ok("GET", "/admin/operator", { token: admin.token });

  assert.equal(operator.current.grossStakes, totalStake);
  assert.equal(operator.current.grossPayouts, payouts);
  assert.equal(operator.current.operatorResult, totalStake - payouts);
  done(`operator ledger: stakes ₦${totalStake / 100}, payouts ₦${payouts / 100}, result ₦${(totalStake - payouts) / 100} (recorded as it is, positive or negative)`);

  assert.equal(count("SELECT count(*) FROM wallet.wallet_accounts w JOIN identity.admin_users a ON a.id = w.owner_id"), 0);
  assert.equal(count("SELECT count(*) FROM identity.customers c JOIN identity.admin_users a ON a.email = c.email"), 0);

  const adminWallet = await call("GET", `/wallets/${admin.admin.id}`, { token: admin.token });

  assert.equal(adminWallet.status, 404, "an admin must not be able to own a wallet");
  done("owner protection: no admin is a customer, no admin has a wallet, and the operator result lives only in the operator ledger");

  await ok("POST", "/admin/operator/periods/close", { token: admin.token, body: { reason: "End-to-end verification" } });

  const commission = (await ok("GET", "/admin/commission", { token: admin.token })).items;

  for (const row of commission) {
    const shopEntries = placed.filter((p) => p.kind === "ticket" && row.grossStakes === p.stake);

    assert.equal(shopEntries.length, 1);
    assert.equal(row.grossOperatorResult, row.grossStakes - row.grossPayouts);
    assert.equal(row.shopShareAmount, row.grossOperatorResult > 0 ? Math.floor((row.grossOperatorResult * row.shopSharePercent) / 100) : 0);
    assert.equal(row.platformShareAmount, row.grossOperatorResult - row.shopShareAmount);
  }

  assert.equal(commission.length, 2);
  done(`commission ledger written for ${commission.length} shops from their realised result at the configured ${commission[0].shopSharePercent}%`);

  const notes = await until("settlement notification", async () => {
    const { items } = await ok("GET", "/users/me/notifications", { token: customerA.token });

    return items.find((item) => item.betId === placed[0].id);
  });

  assert.equal(notes.kind, "BET_SETTLED");

  const foreign = await call("GET", `/users/${customerA.user.id}/notifications`, { token: customerB.token });

  assert.equal(foreign.status, 403);

  const config = await ok("GET", "/config");
  const clocked = await ok("GET", `/matches/${matchId}`);
  const lineups = await ok("GET", `/matches/${matchId}/lineups`);
  const scorers = JSON.parse(timelines[0]).filter((event) => event.type === "GOAL").map((event) => event.player);
  const squad = [...lineups.home.starting, ...lineups.home.substitutes, ...lineups.away.starting, ...lineups.away.substitutes].map((p) => p.name);

  assert.equal(config.currency.code, "NGN");
  assert.equal(clocked.clock.period, "FULL_TIME");
  assert.ok(scorers.every((name) => squad.includes(name)), "a scorer is not in the published lineups");
  done("customer A was told their bet settled; another customer cannot read it; config, clock and lineups are served and the scorers are in the lineups");

  // 28. Analytics aggregate every accepted bet.
  const analysis = await ok("GET", `/admin/analytics/matches/${matchId}`, { token: admin.token });

  assert.equal(analysis.overview.totalBets, 6);
  assert.equal(analysis.overview.totalStake, totalStake);
  assert.equal(analysis.overview.totalPayout, payouts);
  assert.equal(analysis.overview.operatorResult, totalStake - payouts);
  done("analytics includes all 6 bets: total stake, total payout and operator result reconcile with the database");

  // 29–34. Every client shows the same result for the same match id.
  const shown = [];

  for (const token of [customerA.token, customerD.token, undefined, cashier2.token]) shown.push((await ok("GET", `/matches/${matchId}`, { token })).score);

  const adminFinal = await ok("GET", `/admin/matches/${matchId}`, { token: admin.token });
  const listed = (await ok("GET", `/results?leagueId=${league.id}`)).items.find((item) => item.matchId === matchId);

  assert.ok(shown.every((score) => JSON.stringify(score) === JSON.stringify(finished.score)));
  assert.deepEqual(adminFinal.score, finished.score);
  assert.deepEqual(listed.result, { homeGoals: Number(homeGoals), awayGoals: Number(awayGoals), winner, winningGap: Number(gap) });
  done("web, mobile, TV, shop and admin all show the same result for the same match_id");

  // 35. The simulation count stays at one.
  const again = await rpc("simulation", "simulation.runMatch", {
    matchId,
    home: { teamId: home.id, name: home.name, shortName: "Lions", strength: strength(99) },
    away: { teamId: away.id, name: away.name, shortName: "Eagles", strength: strength(1) },
  });

  assert.equal(again.body.result.duplicate, true);
  assert.deepEqual(again.body.result.result, { homeGoals: Number(homeGoals), awayGoals: Number(awayGoals), winner, winningGap: Number(gap) });
  assert.equal(count(`SELECT count(*) FROM simulation.simulation_runs WHERE match_id = '${matchId}'`), 1);

  const rerun = await call("POST", `/admin/matches/${matchId}/actions`, { token: admin.token, body: { action: "RERUN_SIMULATION", reason: "Trying to change a result" } });

  assert.equal(rerun.status, 409);
  assert.equal(rerun.data.error.code, "RESULT_IMMUTABLE");
  done("a second simulation request returns the stored result; an admin re-run is refused as RESULT_IMMUTABLE");

  // 36. Settlement is idempotent.
  const resettled = await rpc("settlement", "settlement.settleMatch", { matchId });

  assert.equal(resettled.body.result.duplicate, true);
  assert.equal(count(`SELECT count(*) FROM settlement.settlements s JOIN betting.bet_selections l ON l.bet_id = s.bet_id WHERE l.match_id = '${matchId}'`), 6);

  for (const entry of placed.filter((p) => p.kind === "bet")) {
    const wallet = await ok("GET", "/wallets/me", { token: entry.token });
    const payout = legOutcome(entry.code, Number(homeGoals), Number(awayGoals)) === "WON" ? entry.potentialPayout : 0;

    assert.equal(wallet.balance, 10_000_000 - entry.stake + payout);
  }

  done("settling the match again pays nobody twice");

  const winningTicket = placed.find((p) => p.kind === "ticket" && legOutcome(p.code, Number(homeGoals), Number(awayGoals)) === "WON");

  if (winningTicket !== undefined) {
    const pin = winningTicket.who === "shop 1" ? "1234" : "4321";
    const paid = await ok("POST", `/shop/tickets/${winningTicket.ticketCode}/payout`, { token: winningTicket.token, body: { pin } });
    const twice = await call("POST", `/shop/tickets/${winningTicket.ticketCode}/payout`, { token: winningTicket.token, body: { pin } });

    assert.equal(paid.status, "PAID");
    assert.equal(twice.status, 409);
    done(`${winningTicket.who} paid its winning ticket once; the second attempt was refused`);
  }

  // Trust boundary.
  const noToken = await rpc("wallet", "wallet.credit", { ownerType: "CUSTOMER", ownerId: customerA.user.id, amount: 1, type: "DEPOSIT", idempotencyKey: "attack-0001" }, false);

  assert.equal(noToken.status, 404, "an RPC call without the internal token must be refused");

  const forgedActor = await call("GET", "/admin/users", { headers: { "x-betng-actor-kind": "ADMIN", "x-betng-actor-id": admin.admin.id, "x-betng-permissions": "users:read" } });

  assert.equal(forgedActor.status, 401);
  done("trust boundary holds: RPC without the internal token is refused and forged actor headers are ignored");
}

function strength(value) {
  return { attack: value, defence: value, midfield: value, goalkeeping: value, pace: value, finishing: value, possession: 50, form: 0, homeAdvantage: 50 };
}

resetDatabase();

const stack = await startStack();
let failed = false;

try {
  console.log("BetNG end-to-end scenario");
  await scenario();
  console.log(`\nAll ${step} steps passed.`);
} catch (error) {
  failed = true;
  console.error(`\nFAILED after step ${step}:`, error instanceof Error ? error.message : error);
  console.error(`Service logs: ${stack.logs}`);
} finally {
  await stack.stop();
}

process.exit(failed ? 1 : 0);
