import { validate } from "@zudojs/validation";
import { describe, expect, it } from "vitest";
import { publishSignalPayloadSchema } from "../src/dtos/index.js";

const CUSTOMER = "5b0c7d1e-2f3a-4b5c-8d9e-0f1a2b3c4d5e";

describe("publishSignal payload", () => {
  it.each([
    ["risk", "RISK_ALERT"],
    [`bets:${CUSTOMER}`, "BET_SETTLED"],
    [`user:${CUSTOMER}`, "BET_ACCEPTED"],
    [`wallet:${CUSTOMER}`, "WALLET_UPDATED"],
  ])("accepts %s %s", (channel, type) => {
    expect(validate(publishSignalPayloadSchema, { channel, type }).success).toBe(true);
  });

  it("accepts only a bet id as the payload hint", () => {
    const channel = `bets:${CUSTOMER}`;

    expect(validate(publishSignalPayloadSchema, { channel, type: "BET_SETTLED", payload: { betId: CUSTOMER } }).success).toBe(true);
    expect(validate(publishSignalPayloadSchema, { channel, type: "BET_SETTLED", payload: { betId: "x" } }).success).toBe(false);
    expect(
      validate(publishSignalPayloadSchema, { channel, type: "BET_SETTLED", payload: { betId: CUSTOMER, payout: 5 } }).success,
    ).toBe(false);
  });

  it.each([
    ["risk", "BET_WON"],
    [`match:${CUSTOMER}`, "BET_SETTLED"],
    ["bets:not-a-uuid", "BET_SETTLED"],
  ])("refuses %s %s", (channel, type) => {
    expect(validate(publishSignalPayloadSchema, { channel, type }).success).toBe(false);
  });
});
