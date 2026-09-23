import { describe, expect, it } from "vitest";
import {
  adminLoginRequestSchema,
  customerRegisterRequestSchema,
  matchAdminActionSchema,
  payoutTicketRequestSchema,
  placeTicketRequestSchema,
  shopLoginRequestSchema,
  teamRatingsSchema,
  ticketStatusSchema,
  verifyEmailRequestSchema,
} from "../src/index.js";

const id = "11111111-1111-4111-8111-111111111111";

describe("account and operations contracts", () => {
  it("accepts a shop login with and without a PIN, and rejects a malformed PIN", () => {
    const base = { shopCode: "BNG-LAG-001", username: "bisi", password: "secret" };

    expect(shopLoginRequestSchema.safeParse(base).success).toBe(true);
    expect(shopLoginRequestSchema.safeParse({ ...base, pin: "1234" }).success).toBe(true);
    expect(shopLoginRequestSchema.safeParse({ ...base, pin: "12a4" }).success).toBe(false);
  });

  it("requires a numeric PIN to pay a ticket out", () => {
    expect(payoutTicketRequestSchema.safeParse({ pin: "1234" }).success).toBe(true);
    expect(payoutTicketRequestSchema.safeParse({}).success).toBe(false);
  });

  it("requires at least one selection and a positive stake on a ticket", () => {
    const selection = { matchId: id, marketId: id, selectionId: id, odds: 1.9 };

    expect(placeTicketRequestSchema.safeParse({ selections: [selection], stake: 10_000 }).success).toBe(true);
    expect(placeTicketRequestSchema.safeParse({ selections: [], stake: 10_000 }).success).toBe(false);
    expect(placeTicketRequestSchema.safeParse({ selections: [selection], stake: 0 }).success).toBe(false);
  });

  it("covers every ticket state the shop renders", () => {
    expect(ticketStatusSchema.options).toEqual(expect.arrayContaining(["OPEN", "WON", "LOST", "VOID", "CANCELLED", "PAID", "EXPIRED"]));
  });

  it("enforces a twelve character password and a six digit verification code", () => {
    const register = (password: string) => customerRegisterRequestSchema.safeParse({ email: "a@b.ng", password, displayName: "Ada" }).success;

    expect(register("short")).toBe(false);
    // Exactly on the boundary either side, so raising the minimum again fails here first.
    expect(register("elevenchars")).toBe(false);
    expect(register("twelvecharss")).toBe(true);
    expect(verifyEmailRequestSchema.safeParse({ email: "a@b.ng", code: "12345" }).success).toBe(false);
  });

  it("takes a six digit TOTP on admin login when one is sent", () => {
    expect(adminLoginRequestSchema.safeParse({ email: "ops@betng.test", password: "x", code: "246810" }).success).toBe(true);
    expect(adminLoginRequestSchema.safeParse({ email: "ops@betng.test", password: "x", code: "2468" }).success).toBe(false);
  });

  it("offers no admin action that decides a result", () => {
    for (const action of matchAdminActionSchema.options) expect(action).not.toMatch(/SCORE|WINNER|RESULT/);
  });

  it("bounds simulation ratings", () => {
    const ratings = { attack: 80, midfield: 78, defence: 75, goalkeeper: 77, pace: 81, finishing: 79, form: 2 };

    expect(teamRatingsSchema.safeParse(ratings).success).toBe(true);
    expect(teamRatingsSchema.safeParse({ ...ratings, attack: 120 }).success).toBe(false);
    expect(teamRatingsSchema.safeParse({ ...ratings, form: 11 }).success).toBe(false);
  });
});
