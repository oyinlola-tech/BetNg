import { describe, expect, it } from "vitest";
import {
  betSchema,
  errorResponseSchema,
  fixtureSchema,
  headToHeadSchema,
  liveEventSchema,
  matchClockSchema,
  matchLineupsSchema,
  matchOddsSchema,
  matchSchema,
  placeBetRequestSchema,
  publicConfigSchema,
  searchResponseSchema,
  settlementSchema,
  transactionSchema,
  walletSchema,
} from "../src/index.js";
import * as wire from "./fixtures/wire.js";

const cases = [
  ["match response", matchSchema, wire.matchResponse],
  ["fixture response", fixtureSchema, wire.fixtureResponse],
  ["market and odds response", matchOddsSchema, wire.oddsResponse],
  ["bet request", placeBetRequestSchema, wire.betRequest],
  ["bet response", betSchema, wire.betResponse],
  ["wallet response", walletSchema, wire.walletResponse],
  ["transaction response", transactionSchema, wire.transactionResponse],
  ["settlement response", settlementSchema, wire.settlementResponse],
  ["error envelope", errorResponseSchema, wire.errorResponse],
  ["match clock", matchClockSchema, wire.clockResponse],
  ["lineups", matchLineupsSchema, wire.lineupsResponse],
  ["head to head", headToHeadSchema, wire.headToHeadResponse],
  ["search", searchResponseSchema, wire.searchResponse],
  ["public configuration", publicConfigSchema, wire.configResponse],
] as const;

describe("wire fixtures", () => {
  it.each(cases)("%s matches its schema", (_name, schema, payload) => {
    const result = schema.safeParse(payload);

    expect(result.success ? [] : result.error.issues).toEqual([]);
  });

  it.each(wire.liveFrames)("realtime frame $type matches the event schema", (frame) => {
    expect(liveEventSchema.safeParse(frame).success).toBe(true);
  });

  it("keeps money integral: a fractional stake is refused", () => {
    expect(placeBetRequestSchema.safeParse({ ...wire.betRequest, stake: 500.5 }).success).toBe(false);
    expect(walletSchema.safeParse({ ...wire.walletResponse, balance: 0.1 }).success).toBe(false);
  });

  it("refuses a result decided by the client: a bet request carries no outcome or payout field that is honoured", () => {
    const parsed = placeBetRequestSchema.parse({ ...wire.betRequest, potentialPayout: 1, status: "WON" });

    expect(parsed).not.toHaveProperty("potentialPayout");
    expect(parsed).not.toHaveProperty("status");
  });
});
