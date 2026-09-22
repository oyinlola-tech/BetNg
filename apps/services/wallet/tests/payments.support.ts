import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import process from "node:process";
import { createRpcClient } from "@betng/service-kit";
import type { RPCClient } from "@zudojs/rpc";
import { createApp } from "../src/app.js";
import type { WalletApp } from "../src/app.js";
import { IdentityUnavailableError } from "../src/clients/identity.client.js";
import type { AuditRecord, IdentityPeer, KycAnswer, LimitDecision, PaymentNotification } from "../src/clients/identity.client.js";
import { loadWalletConfig, loadWalletSettings } from "../src/configs/index.js";
import { hmacSha512Hex } from "../src/security/crypto.js";
import { BASE_URL, INTERNAL_TOKEN, TEST_PORT, WALLET_URL } from "./support.js";

export const PAYSTACK_KEY = `sk_test_${"a1b2c3d4".repeat(5)}`;

export const ENCRYPTION_KEY = randomBytes(32).toString("base64");

export interface Charge {
  status: string;
  amount: number;
  currency: string;
}

export interface FakePaystack {
  readonly url: string;
  readonly charges: Map<string, Charge>;
  readonly transfers: Map<string, Charge>;
  readonly calls: { method: string; path: string; body: unknown }[];
  /** Milliseconds every verify call waits, to widen race windows. */
  verifyDelayMs: number;
  down: boolean;
  close(): Promise<void>;
}

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(chunk as Buffer);
  }

  const text = Buffer.concat(chunks).toString("utf8");

  return text === "" ? undefined : (JSON.parse(text) as unknown);
}

export async function startFakePaystack(): Promise<FakePaystack> {
  const fake = {
    charges: new Map<string, Charge>(),
    transfers: new Map<string, Charge>(),
    calls: [] as { method: string; path: string; body: unknown }[],
    verifyDelayMs: 0,
    down: false,
  };

  const server: Server = createServer((request, response) => {
    void (async () => {
      const body = await readBody(request);
      const url = new URL(request.url ?? "/", "http://fake");
      const path = url.pathname;

      fake.calls.push({ method: request.method ?? "GET", path, body });

      if (request.headers.authorization !== `Bearer ${PAYSTACK_KEY}`) {
        send(response, 401, { status: false, message: "Invalid key" });
        return;
      }

      if (fake.down) {
        send(response, 503, { status: false });
        return;
      }

      if (path === "/transaction/initialize") {
        const reference = (body as { reference: string }).reference;

        send(response, 200, {
          status: true,
          data: { authorization_url: `https://checkout.paystack.test/${reference}`, access_code: "ac", reference },
        });
        return;
      }

      if (path.startsWith("/transaction/verify/")) {
        const reference = decodeURIComponent(path.slice("/transaction/verify/".length));

        await new Promise((resolve) => setTimeout(resolve, fake.verifyDelayMs));

        const charge = fake.charges.get(reference) ?? { status: "abandoned", amount: 0, currency: "NGN" };

        send(response, 200, { status: true, data: { id: 42, reference, ...charge } });
        return;
      }

      if (path === "/bank") {
        send(response, 200, {
          status: true,
          data: [
            { name: "Guaranty Trust Bank", code: "058", active: true },
            { name: "Access Bank", code: "044", active: true },
          ],
          meta: {},
        });
        return;
      }

      if (path === "/bank/resolve") {
        const accountNumber = url.searchParams.get("account_number") ?? "";

        if (accountNumber.startsWith("000")) {
          send(response, 422, { status: false, message: "Could not resolve account name." });
          return;
        }

        send(response, 200, { status: true, data: { account_number: accountNumber, account_name: "ADA OBI" } });
        return;
      }

      if (path === "/transferrecipient") {
        send(response, 201, { status: true, data: { recipient_code: "RCP_test123" } });
        return;
      }

      if (path === "/transfer") {
        const { reference, amount } = body as { reference: string; amount: number };

        if (!fake.transfers.has(reference)) {
          fake.transfers.set(reference, { status: "pending", amount, currency: "NGN" });
        }

        send(response, 200, { status: true, data: { transfer_code: `TRF_${reference.slice(-6)}`, status: "pending", amount, reference } });
        return;
      }

      if (path.startsWith("/transfer/verify/")) {
        const reference = decodeURIComponent(path.slice("/transfer/verify/".length));
        const transfer = fake.transfers.get(reference);

        if (transfer === undefined) {
          send(response, 404, { status: false, message: "Transfer not found" });
          return;
        }

        send(response, 200, { status: true, data: { reference, ...transfer } });
        return;
      }

      send(response, 404, { status: false });
    })().catch(() => {
      send(response, 500, { status: false });
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  const { port } = server.address() as AddressInfo;

  return Object.assign(fake, {
    url: `http://127.0.0.1:${String(port)}`,
    close: async () =>
      new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      }),
  });
}

export interface StubIdentity extends IdentityPeer {
  limit: LimitDecision;
  kyc: KycAnswer;
  unreachable: boolean;
  auditFails: boolean;
  readonly audits: AuditRecord[];
  readonly notifications: PaymentNotification[];
  readonly limitCalls: { userId: string; action: string; amount: number }[];
}

export function stubIdentity(): StubIdentity {
  const stub: StubIdentity = {
    limit: { allowed: true },
    kyc: { status: "VERIFIED", tier: "TIER_2", dailyDeposit: undefined, dailyWithdrawal: undefined },
    unreachable: false,
    auditFails: false,
    audits: [],
    notifications: [],
    limitCalls: [],
    checkLimit: async (userId, action, amount) => {
      if (stub.unreachable) throw new IdentityUnavailableError("limits.check");
      stub.limitCalls.push({ userId, action, amount });
      return stub.limit;
    },
    kycStatus: async () => {
      if (stub.unreachable) throw new IdentityUnavailableError("kyc.status");
      return stub.kyc;
    },
    verifyCashierPin: async (_cashierId, pin) => {
      if (stub.unreachable) throw new IdentityUnavailableError("identity.verifyCashierPin");
      return pin === "2468";
    },
    recordAudit: async (entry) => {
      if (stub.unreachable || stub.auditFails) throw new IdentityUnavailableError("identity.recordAudit");
      stub.audits.push(entry);
    },
    notify: async (notification) => {
      stub.notifications.push(notification);
    },
  };

  return stub;
}

export interface PaymentsApp {
  readonly app: WalletApp;
  readonly identity: StubIdentity;
  readonly signals: string[];
  readonly rpc: RPCClient;
  stop(): Promise<void>;
}

export async function startPaymentsApp(env: Readonly<Record<string, string>>): Promise<PaymentsApp> {
  process.env["INTERNAL_SERVICE_TOKEN"] = INTERNAL_TOKEN;

  const identity = stubIdentity();
  const signals: string[] = [];
  const config = await loadWalletConfig({
    NODE_ENV: "test",
    LOG_LEVEL: "fatal",
    HOST: "127.0.0.1",
    WALLET_PORT: String(TEST_PORT),
    WALLET_DATABASE_URL: WALLET_URL,
  });
  const app = createApp(config, loadWalletSettings({ NODE_ENV: "test", ...env }), {
    identity,
    signals: {
      walletChanged: (userId) => {
        signals.push(`wallet:${userId}`);
      },
      shopChanged: (shopId) => {
        signals.push(`shop:${shopId}`);
      },
    },
  });

  await app.server.start();

  const rpc = createRpcClient({ name: "wallet", url: BASE_URL, timeoutMs: 20_000 });

  return {
    app,
    identity,
    signals,
    rpc,
    stop: async () => {
      await rpc.close();
      await app.server.stop();

      for (const hook of app.onShutdown) {
        await hook();
      }
    },
  };
}

export async function webhook(path: string, payload: unknown, signature?: string): Promise<{ status: number; body: unknown }> {
  const raw = JSON.stringify(payload);
  const response = await fetch(`${BASE_URL}/api/v1/payments/webhook/${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-paystack-signature": signature ?? hmacSha512Hex(PAYSTACK_KEY, Buffer.from(raw)),
    },
    body: raw,
  });
  const text = await response.text();

  return { status: response.status, body: text === "" ? undefined : (JSON.parse(text) as unknown) };
}
