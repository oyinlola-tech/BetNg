import { describe, expect, it } from "vitest";
import type { PaymentRecord } from "@betng/contracts";
import { paymentPollDelay, paymentSummary } from "../../src/lib/payments";

describe("paymentPollDelay", () => {
  it("stops once the platform reports a terminal status", () => {
    for (const status of ["CONFIRMED", "FAILED", "CANCELLED", "EXPIRED", "REVERSED"] as const) {
      expect(paymentPollDelay(status, 0)).toBeUndefined();
    }
  });

  it("backs off while the payment is still open", () => {
    expect(paymentPollDelay("INITIATED", 0)).toBe(3000);
    expect(paymentPollDelay("PENDING", 2)).toBe(5000);
    expect(paymentPollDelay("PROCESSING", 4)).toBe(10_000);
    expect(paymentPollDelay("PROCESSING", 50)).toBe(30_000);
  });
});

describe("paymentSummary", () => {
  it("describes only CONFIRMED as done", () => {
    const base = { direction: "DEPOSIT" } as PaymentRecord;

    expect(paymentSummary({ ...base, status: "CONFIRMED" })).toContain("confirmed");
    for (const status of ["INITIATED", "PENDING", "PROCESSING"] as const) {
      expect(paymentSummary({ ...base, status })).toContain("not confirmed yet");
    }
  });
});
