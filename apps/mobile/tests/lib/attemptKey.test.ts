import { describe, expect, it } from "vitest";
import { createAttemptKey } from "../../src/lib/attemptKey";

describe("createAttemptKey", () => {
  const sequence = () => {
    let n = 0;

    return () => `k${String(++n)}`;
  };

  it("reuses the key for retries of the same request", () => {
    const attempt = createAttemptKey(sequence());

    expect(attempt.keyFor("5000|CARD")).toBe("k1");
    expect(attempt.keyFor("5000|CARD")).toBe("k1");
  });

  it("starts a new attempt when the request changes or after a reset", () => {
    const attempt = createAttemptKey(sequence());

    expect(attempt.keyFor("5000|CARD")).toBe("k1");
    expect(attempt.keyFor("6000|CARD")).toBe("k2");
    expect(attempt.keyFor("6000|USSD")).toBe("k3");
    attempt.reset();
    expect(attempt.keyFor("6000|USSD")).toBe("k4");
  });
});
