import { EventEmitter } from "node:events";
import { OPAQUE_ERROR_MESSAGE as CONTRACT_MESSAGE } from "@betng/contracts/runtime";
import { afterEach, describe, expect, it } from "vitest";
import {
  canonicalIp,
  createErrorHandler,
  createIpMatcher,
  createMetricsRegistry,
  createServiceServer,
  installProcessHandlers,
  loadServiceConfig,
  OPAQUE_ERROR_MESSAGE,
} from "../src/index.js";
import type { Logger, RunnableService } from "../src/index.js";

interface Line {
  readonly level: string;
  readonly message: string;
  readonly meta: Record<string, unknown>;
}

function recordingLogger(lines: Line[]): Logger {
  const write = (level: string) => (message: string, meta: Record<string, unknown> = {}) => {
    lines.push({ level, message, meta });
  };

  return {
    error: write("error"),
    warn: write("warn"),
    info: write("info"),
    debug: write("debug"),
    flush: async () => undefined,
  } as unknown as Logger;
}

function fakeRequest(): Parameters<ReturnType<typeof createErrorHandler>>[1] {
  return {
    method: "GET",
    path: "/boom",
    id: "req-fallback",
    getState: () => "req-12345678",
    getHeader: () => undefined,
  } as unknown as Parameters<ReturnType<typeof createErrorHandler>>[1];
}

describe("error handler", () => {
  it("never logs a stack when stacks are off, keeps the correlation id and answers the opaque message", () => {
    const lines: Line[] = [];
    const handler = createErrorHandler(recordingLogger(lines), { logStacks: false });
    const response = handler(new Error("db password=hunter2 at host"), fakeRequest());
    const raw: unknown = response.body;
    const body = (typeof raw === "string" ? JSON.parse(raw) : raw) as { error: { message: string; requestId: string } };

    expect(response.status).toBe(500);
    expect(JSON.stringify(response.headers)).toContain("req-12345678");
    expect(body.error.message).toBe(OPAQUE_ERROR_MESSAGE);
    expect(body.error.requestId).toBe("req-12345678");
    expect(lines[0]?.meta["stack"]).toBeUndefined();
    expect(lines[0]?.meta["requestId"]).toBe("req-12345678");
  });

  it("logs stacks only when allowed", () => {
    const lines: Line[] = [];

    createErrorHandler(recordingLogger(lines), { logStacks: true })(new Error("boom"), fakeRequest());

    expect(String(lines[0]?.meta["stack"])).toContain("Error: boom");
  });

  it("shares one opaque message with the contracts package", () => {
    expect(OPAQUE_ERROR_MESSAGE).toBe(CONTRACT_MESSAGE);
  });
});

describe("process handlers", () => {
  const disposers: (() => void)[] = [];

  afterEach(() => {
    for (const dispose of disposers.splice(0)) dispose();
  });

  function service(lines: Line[], steps: string[]): RunnableService {
    return {
      logger: recordingLogger(lines),
      server: {
        stop: async () => {
          steps.push("server");
        },
      } as unknown as RunnableService["server"],
      onShutdown: [
        async () => {
          steps.push("release");
        },
      ],
    };
  }

  it("drains and exits 1 on an unhandled rejection, logging no stack when stacks are off", async () => {
    const lines: Line[] = [];
    const steps: string[] = [];
    const target = new EventEmitter();
    const exits: number[] = [];
    const previous = process.env["NODE_ENV"];

    process.env["NODE_ENV"] = "production";

    const controller = installProcessHandlers(service(lines, steps), {
      processLike: target as unknown as NodeJS.Process,
      exit: (code) => exits.push(code),
      shutdownTimeoutMs: 5000,
    });

    process.env["NODE_ENV"] = previous;
    disposers.push(controller.dispose);

    target.emit("unhandledRejection", new Error("lost promise"));
    await controller.shutdown("again", 0);

    expect(steps).toEqual(["server", "release"]);
    expect(exits).toEqual([1]);
    expect(lines.find((line) => line.message === "Unhandled promise rejection")?.meta["stack"]).toBeUndefined();
  });

  it("exits 0 on SIGTERM and 1 when a shutdown step fails", async () => {
    const exits: number[] = [];
    const target = new EventEmitter();
    const controller = installProcessHandlers(service([], []), {
      processLike: target as unknown as NodeJS.Process,
      exit: (code) => exits.push(code),
      shutdownTimeoutMs: 5000,
    });

    disposers.push(controller.dispose);
    target.emit("SIGTERM", "SIGTERM");
    await controller.shutdown("wait", 0);

    const failing = new EventEmitter();
    const broken: RunnableService = {
      ...service([], []),
      onShutdown: [
        async () => {
          throw new Error("redis close failed");
        },
      ],
    };
    const second = installProcessHandlers(broken, {
      processLike: failing as unknown as NodeJS.Process,
      exit: (code) => exits.push(code),
      shutdownTimeoutMs: 5000,
    });

    disposers.push(second.dispose);
    await second.shutdown("SIGTERM", 0);

    expect(exits).toEqual([0, 1]);
  });
});

describe("metrics", () => {
  it("renders Prometheus text with a latency histogram per route template", () => {
    const registry = createMetricsRegistry("gateway");

    registry.observe("GET", "/api/v1/matches/:id", 200, 0.004);
    registry.observe("GET", "/api/v1/matches/:id", 200, 0.3);
    registry.observe("POST", "/api/v1/bets", 409, 0.02);

    const text = registry.render();

    expect(text).toContain('http_requests_total{service="gateway",method="GET",route="/api/v1/matches/:id",status="200"} 2');
    expect(text).toContain('http_request_duration_seconds_bucket{service="gateway",method="GET",route="/api/v1/matches/:id",status="200",le="0.005"} 1');
    expect(text).toContain('http_request_duration_seconds_bucket{service="gateway",method="GET",route="/api/v1/matches/:id",status="200",le="+Inf"} 2');
    expect(text).toContain("# TYPE http_request_duration_seconds histogram");
    expect(text).toMatch(/process_resident_memory_bytes\{service="gateway"\} \d+/);
  });

  it("is mounted internal-only on every service server", async () => {
    const previous = process.env["INTERNAL_SERVICE_TOKEN"];
    const token = `internal-${crypto.randomUUID()}`;

    process.env["INTERNAL_SERVICE_TOKEN"] = token;

    const config = await loadServiceConfig({
      serviceName: "risk",
      version: "0.0.1",
      defaultPort: 4197,
      env: { NODE_ENV: "test", LOG_LEVEL: "fatal", HOST: "127.0.0.1", RISK_PORT: "4197" },
    });
    const server = createServiceServer({ config, logger: recordingLogger([]), routes: () => undefined });

    await server.start();

    try {
      const base = `http://127.0.0.1:${String(server.port)}`;

      await fetch(`${base}/health`);

      const outside = await fetch(`${base}/metrics`);
      const inside = await fetch(`${base}/metrics`, { headers: { "x-betng-internal-token": token } });

      expect(outside.status).toBe(404);
      expect(outside.headers.get("x-request-id")).not.toBeNull();
      expect(inside.status).toBe(200);
      expect(await inside.text()).toContain('route="/health"');
    } finally {
      await server.stop();
      if (previous === undefined) delete process.env["INTERNAL_SERVICE_TOKEN"];
      else process.env["INTERNAL_SERVICE_TOKEN"] = previous;
    }
  });
});

describe("IP matching", () => {
  it("matches single addresses and CIDR ranges in both families and folds mapped IPv4", () => {
    const matches = createIpMatcher(["203.0.113.0/24", "198.51.100.7", "2001:db8::/32"]);

    expect(matches("203.0.113.200")).toBe(true);
    expect(matches("::ffff:198.51.100.7")).toBe(true);
    expect(matches("198.51.100.8")).toBe(false);
    expect(matches("2001:db8:1::5")).toBe(true);
    expect(matches("2001:db9::1")).toBe(false);
    expect(canonicalIp("::ffff:10.0.0.1")).toBe("10.0.0.1");
  });

  it("refuses a malformed entry at start-up", () => {
    expect(() => createIpMatcher(["not-an-ip"])).toThrow(/not an IP address/);
  });
});
