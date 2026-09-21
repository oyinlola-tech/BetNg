import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PostEntryInput } from "../src/interfaces/index.js";
import {
  api,
  createFixtures,
  errorCode,
  openRepository,
  startApp,
  WELCOME_GRANT,
} from "./support.js";
import type {
  ActorInit,
  ApiResponse,
  DirectRepository,
  Fixtures,
  RunningApp,
} from "./support.js";

interface Item {
  readonly id: string;
  readonly walletId: string;
  readonly type: string;
  readonly amount: number;
  readonly balanceAfter: number;
  readonly reference?: string;
  readonly note?: string;
  readonly status?: string;
  readonly createdAt: string;
}

interface PageBody {
  readonly items: readonly Item[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

const ADMIN: ActorInit = {
  kind: "ADMIN",
  id: randomUUID(),
  permissions: ["wallet:read"],
};

const LEDGER: readonly (Pick<PostEntryInput, "type" | "amount"> & {
  readonly reference?: string;
  readonly note?: string;
})[] = [
  { type: "DEPOSIT", amount: 250_000n, reference: "dep-100%", note: "Top-up 100% bonus" },
  { type: "BET_STAKE", amount: -50_000n, reference: "bet_A1" },
  { type: "BET_PAYOUT", amount: 128_000n, reference: "betXA1", note: "Winning bet payout" },
  { type: "BET_REFUND", amount: 50_000n, reference: "refund-1" },
  { type: "WITHDRAWAL", amount: -100_000n },
  { type: "ADJUSTMENT", amount: 7n, note: "Correction up" },
  { type: "ADJUSTMENT", amount: -3n, note: "Correction down" },
];

const TOTAL = LEDGER.length + 1;

let fixtures: Fixtures;
let running: RunningApp;
let direct: DirectRepository;
let customerId: string;
let actor: ActorInit;

beforeAll(async () => {
  fixtures = await createFixtures();
  running = await startApp();
  direct = await openRepository();

  customerId = await fixtures.customer();
  actor = { kind: "CUSTOMER", id: customerId };

  await api("GET", "/api/v1/wallets/me", { actor });

  for (const entry of LEDGER) {
    await sleep(5);
    await direct.wallets.postEntry({
      ownerType: "CUSTOMER",
      ownerId: customerId,
      idempotencyKey: randomUUID(),
      ...entry,
    });
  }
});

afterAll(async () => {
  await direct.close();
  await running.stop();
  await fixtures.close();
});

async function page(query: string, as: ActorInit = actor): Promise<ApiResponse> {
  return api("GET", `/api/v1/wallets/${customerId}/transactions?${query}`, {
    actor: as,
  });
}

async function pageOf(query: string): Promise<PageBody> {
  const response = await page(query);

  expect(response.status).toBe(200);

  return response.body as PageBody;
}

describe("unpaged ledger", () => {
  it("keeps the {items} answer with no paging fields and no status", async () => {
    const response = await api("GET", "/api/v1/wallets/me/transactions", {
      actor,
    });
    const body = response.body as { items: Item[] };

    expect(response.status).toBe(200);
    expect(Object.keys(body)).toEqual(["items"]);
    expect(body.items).toHaveLength(TOTAL);
    expect(body.items[0]).not.toHaveProperty("status");
    expect(body.items.at(-1)).toMatchObject({
      type: "WELCOME_GRANT",
      amount: WELCOME_GRANT,
    });

    const limited = await api("GET", "/api/v1/wallets/me/transactions?limit=2", {
      actor,
    });

    expect((limited.body as { items: Item[] }).items).toHaveLength(2);
  });

  it("still refuses paging parameters when page is absent", async () => {
    const response = await api(
      "GET",
      "/api/v1/wallets/me/transactions?pageSize=5",
      { actor },
    );

    expect(response.status).toBe(422);
  });
});

describe("paged ledger", () => {
  it("answers the Page envelope with totals across pages", async () => {
    const first = await pageOf("page=1&pageSize=3");
    const third = await pageOf("page=3&pageSize=3");
    const beyond = await pageOf("page=4&pageSize=3");

    expect(Object.keys(first).sort()).toEqual([
      "items",
      "page",
      "pageSize",
      "total",
    ]);
    expect(first).toMatchObject({ page: 1, pageSize: 3, total: TOTAL });
    expect(first.items).toHaveLength(3);
    expect(third).toMatchObject({ page: 3, pageSize: 3, total: TOTAL });
    expect(third.items).toHaveLength(2);
    expect(beyond).toMatchObject({ page: 4, total: TOTAL, items: [] });

    const seen = new Set(
      [first, await pageOf("page=2&pageSize=3"), third].flatMap((body) =>
        body.items.map((item) => item.id),
      ),
    );

    expect(seen.size).toBe(TOTAL);
  });

  it("defaults to 20 per page, newest first, every entry COMPLETED", async () => {
    const body = await pageOf("page=1");

    expect(body.pageSize).toBe(20);
    expect(body.items.map((item) => item.amount)).toEqual([
      -3,
      7,
      -100_000,
      50_000,
      128_000,
      -50_000,
      250_000,
      WELCOME_GRANT,
    ]);
    expect(body.items.every((item) => item.status === "COMPLETED")).toBe(true);
    expect(body.items[6]).toMatchObject({
      type: "DEPOSIT",
      reference: "dep-100%",
      note: "Top-up 100% bonus",
    });
  });

  it("filters by type, expanding the contract's display types like the overview does", async () => {
    const types = async (list: string): Promise<string[]> =>
      (await pageOf(`page=1&types=${list}`)).items.map(
        (item) => `${item.type}:${String(item.amount)}`,
      );

    expect(await types("DEPOSIT")).toEqual([
      "ADJUSTMENT:7",
      "DEPOSIT:250000",
      `WELCOME_GRANT:${String(WELCOME_GRANT)}`,
    ]);
    expect(await types("WITHDRAWAL")).toEqual([
      "ADJUSTMENT:-3",
      "WITHDRAWAL:-100000",
    ]);
    expect(await types("BET_STAKE,BET_PAYOUT")).toEqual([
      "BET_PAYOUT:128000",
      "BET_STAKE:-50000",
    ]);
    expect(await types("BET_REFUND")).toEqual(["BET_REFUND:50000"]);
    expect(await types("ADJUSTMENT")).toEqual(["ADJUSTMENT:-3", "ADJUSTMENT:7"]);
    expect(await types("WELCOME_GRANT")).toEqual([
      `WELCOME_GRANT:${String(WELCOME_GRANT)}`,
    ]);
    expect(await types("TICKET_SALE")).toEqual([]);
    expect((await pageOf("page=1&types=DEPOSIT")).total).toBe(3);
  });

  it("refuses a type or status outside the allowlists", async () => {
    for (const query of [
      "types=BONUS",
      "types=DEPOSIT,BONUS",
      `types=${encodeURIComponent("DEPOSIT'; DROP TABLE wallet.wallet_transactions; --")}`,
      "statuses=DONE",
      "statuses=COMPLETED,DONE",
    ]) {
      const response = await page(`page=1&${query}`);

      expect(response.status).toBe(422);
      expect(errorCode(response)).toBe("VALIDATION_FAILED");
    }
  });

  it("treats every entry as COMPLETED", async () => {
    expect((await pageOf("page=1&statuses=COMPLETED")).total).toBe(TOTAL);
    expect((await pageOf("page=1&statuses=PENDING,COMPLETED")).total).toBe(TOTAL);
    expect(await pageOf("page=2&pageSize=5&statuses=PENDING,FAILED,REVERSED")).toEqual({
      items: [],
      page: 2,
      pageSize: 5,
      total: 0,
    });
  });

  it("filters by created_at with from and to", async () => {
    const all = (await pageOf("page=1&direction=asc")).items;
    const third = all[2];
    const fifth = all[4];

    if (third === undefined || fifth === undefined) {
      throw new Error("The ledger is shorter than the fixture.");
    }

    const from = await pageOf(`page=1&direction=asc&from=${third.createdAt}`);
    const to = await pageOf(`page=1&direction=asc&to=${third.createdAt}`);
    const between = await pageOf(
      `page=1&direction=asc&from=${third.createdAt}&to=${fifth.createdAt}`,
    );
    const inverted = await pageOf(
      `page=1&from=${fifth.createdAt}&to=${third.createdAt}`,
    );

    expect(from.items.map((item) => item.id)).toEqual(
      all.slice(2).map((item) => item.id),
    );
    expect(to.items.map((item) => item.id)).toEqual(
      all.slice(0, 3).map((item) => item.id),
    );
    expect(between.items.map((item) => item.id)).toEqual(
      all.slice(2, 5).map((item) => item.id),
    );
    expect(between.total).toBe(3);
    expect(inverted.total).toBe(0);
    expect((await page("page=1&from=yesterday")).status).toBe(422);
  });

  it("searches reference and note literally, without wildcards or injection", async () => {
    const references = async (term: string): Promise<(string | undefined)[]> =>
      (await pageOf(`page=1&search=${encodeURIComponent(term)}`)).items.map(
        (item) => item.reference ?? item.note,
      );

    expect(await references("100%")).toEqual(["dep-100%"]);
    expect(await references("%")).toEqual(["dep-100%"]);
    expect(await references("bet_A1")).toEqual(["bet_A1"]);
    expect(await references("BET_a1")).toEqual(["bet_A1"]);
    expect(await references("_")).toEqual(["bet_A1"]);
    expect(await references("winning")).toEqual(["betXA1"]);
    expect(await references("correction")).toEqual([
      "Correction down",
      "Correction up",
    ]);
    expect(await references("!")).toEqual([]);
    expect(await references("\\")).toEqual([]);
    expect(await references("' OR 1=1 --")).toEqual([]);
    expect((await page(`page=1&search=${"x".repeat(81)}`)).status).toBe(422);
  });

  it("sorts only by the allowlisted fields and directions", async () => {
    const amounts = async (query: string): Promise<number[]> =>
      (await pageOf(`page=1&${query}`)).items.map((item) => item.amount);

    expect((await amounts("sort=amount&direction=desc")).slice(0, 3)).toEqual([
      WELCOME_GRANT,
      250_000,
      128_000,
    ]);
    expect((await amounts("sort=amount&direction=asc")).slice(0, 3)).toEqual([
      -100_000, -50_000, -3,
    ]);
    expect((await amounts("sort=createdAt&direction=asc"))[0]).toBe(WELCOME_GRANT);

    for (const query of [
      "sort=balanceAfter",
      "sort=created_at",
      `sort=${encodeURIComponent("amount; DROP TABLE wallet.wallet_accounts")}`,
      `sort=${encodeURIComponent("(SELECT 1)")}`,
      "direction=up",
      `direction=${encodeURIComponent("desc, id")}`,
    ]) {
      const response = await page(`page=1&${query}`);

      expect(response.status).toBe(422);
      expect(errorCode(response)).toBe("VALIDATION_FAILED");
    }
  });

  it("bounds page and pageSize and refuses unknown parameters", async () => {
    for (const query of [
      "page=0",
      "page=-1",
      "page=1.5",
      "page=abc",
      "page=",
      "page=100001",
      "page=1&pageSize=0",
      "page=1&pageSize=101",
      "page=1&limit=5",
      "page=1&userId=someone",
    ]) {
      expect((await page(query)).status).toBe(422);
    }

    expect((await pageOf("page=1&pageSize=100")).pageSize).toBe(100);
  });

  it("applies the wallet's access rules to the paged form", async () => {
    const stranger = await fixtures.customer();

    const other = await page("page=1", { kind: "CUSTOMER", id: stranger });
    const admin = await page("page=1", ADMIN);
    const adminWithout = await page("page=1", {
      kind: "ADMIN",
      id: randomUUID(),
      permissions: ["bets:read"],
    });
    const cashier = await page("page=1", {
      kind: "CASHIER",
      id: randomUUID(),
      shopId: randomUUID(),
      permissions: ["transactions:read"],
    });
    const anonymous = await api(
      "GET",
      `/api/v1/wallets/${customerId}/transactions?page=1`,
    );
    const forged = await api(
      "GET",
      `/api/v1/wallets/${customerId}/transactions?page=1`,
      { actor, external: true },
    );
    const own = await api("GET", "/api/v1/wallets/me/transactions?page=1", {
      actor: { kind: "CUSTOMER", id: stranger },
    });

    expect(other.status).toBe(403);
    expect(errorCode(other)).toBe("FORBIDDEN");
    expect(admin.status).toBe(200);
    expect((admin.body as PageBody).total).toBe(TOTAL);
    expect(adminWithout.status).toBe(403);
    expect(cashier.status).toBe(403);
    expect(anonymous.status).toBe(401);
    expect(forged.status).toBe(401);
    expect((own.body as PageBody).total).toBe(1);
    expect((own.body as PageBody).items[0]?.type).toBe("WELCOME_GRANT");
  });
});
