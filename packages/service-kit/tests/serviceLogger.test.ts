import { afterEach, describe, expect, it, vi } from "vitest";
import { createServiceLogger, loadServiceConfig } from "../src/index.js";

afterEach(() => {
  vi.restoreAllMocks();
});

async function capture(log: (logger: ReturnType<typeof createServiceLogger>) => void): Promise<string[]> {
  const lines: string[] = [];

  vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    lines.push(String(chunk));

    return true;
  });

  const config = await loadServiceConfig({
    serviceName: "match",
    version: "1.2.3",
    defaultPort: 4199,
    env: { NODE_ENV: "test", LOG_LEVEL: "info" },
  });

  log(createServiceLogger(config));

  return lines;
}

describe("service logger", () => {
  it("writes each entry as one JSON line carrying the message and its metadata", async () => {
    const lines = await capture((logger) => {
      logger.info("Match opened", { event: "match_opened", matchId: "m-1" });
    });

    expect(lines).toHaveLength(1);
    expect(lines[0]?.endsWith("\n")).toBe(true);
    expect(JSON.parse(lines[0] ?? "")).toMatchObject({
      message: "Match opened",
      levelName: "info",
      metadata: { service: "match", version: "1.2.3", event: "match_opened", matchId: "m-1" },
    });
  });

  it("redacts a secret field and stays silent below its level", async () => {
    const lines = await capture((logger) => {
      logger.debug("not written");
      logger.info("Signed in", { password: "correct-horse-battery" });
    });

    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain("correct-horse-battery");
  });
});
