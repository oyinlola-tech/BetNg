import { describe, expect, it } from "vitest";
import { notificationTarget } from "../../src/platform/notificationRoutes";

describe("notificationTarget", () => {
  it("opens the match for match kinds", () => {
    for (const kind of ["MATCH_STARTING", "MATCH_FINISHED", "RESULT_AVAILABLE", "MATCH_EVENT"]) {
      expect(notificationTarget({ kind, matchId: "M_1" })).toEqual({ name: "Match", matchId: "M_1" });
    }
  });

  it("falls back to results or home when a match notification has no usable id", () => {
    expect(notificationTarget({ kind: "RESULT_AVAILABLE" })).toEqual({ name: "Results" });
    expect(notificationTarget({ kind: "MATCH_FINISHED", matchId: "../x" })).toEqual({ name: "Results" });
    expect(notificationTarget({ kind: "MATCH_STARTING" })).toEqual({ name: "Home" });
  });

  it("opens the bet for bet kinds, else the bets tab", () => {
    expect(notificationTarget({ kind: "BET_ACCEPTED", betId: "BET42" })).toEqual({ name: "Bet", betId: "BET42" });
    expect(notificationTarget({ kind: "BET_SETTLED", betId: "BET42", matchId: "M_1" })).toEqual({ name: "Bet", betId: "BET42" });
    expect(notificationTarget({ kind: "BET_SETTLED" })).toEqual({ name: "Bets" });
    expect(notificationTarget({ kind: "BET_SETTLED", betId: "a/b" })).toEqual({ name: "Bets" });
  });

  it("opens the payment when a reference is present, else the wallet", () => {
    expect(notificationTarget({ kind: "PAYMENT_UPDATED", paymentReference: "PAY-000123" })).toEqual({ name: "Payment", reference: "PAY-000123" });
    expect(notificationTarget({ kind: "PAYMENT_UPDATED", paymentReference: "x" })).toEqual({ name: "Wallet" });
    expect(notificationTarget({ kind: "PAYMENT_UPDATED" })).toEqual({ name: "Wallet" });
  });

  it("opens the account for KYC, security and limit notices", () => {
    expect(notificationTarget({ kind: "KYC_UPDATED" })).toEqual({ name: "Account" });
    expect(notificationTarget({ kind: "SECURITY_ALERT", matchId: "M_1" })).toEqual({ name: "Account" });
    expect(notificationTarget({ kind: "LIMIT_WARNING" })).toEqual({ name: "Account" });
  });

  it("treats untrusted payloads defensively", () => {
    expect(notificationTarget(null)).toEqual({ name: "Home" });
    expect(notificationTarget("MATCH_EVENT")).toEqual({ name: "Home" });
    expect(notificationTarget({ kind: 7, matchId: 12 })).toEqual({ name: "Home" });
    expect(notificationTarget({ kind: "UNKNOWN", matchId: "M_1" })).toEqual({ name: "Match", matchId: "M_1" });
    expect(notificationTarget({ kind: "MATCH_EVENT", matchId: "M_1%2F" })).toEqual({ name: "Home" });
  });
});
