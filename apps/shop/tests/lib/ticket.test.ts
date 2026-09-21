import type { Ticket } from "@betng/contracts";
import { describe, expect, it } from "vitest";
import { isPayable, verdictFor } from "../../src/lib/ticket";

const ticket = (status: Ticket["status"]): Ticket => ({ status }) as Ticket;

describe("ticket verdicts", () => {
  it("reads the verdict from the platform's status only", () => {
    expect(verdictFor(ticket("WON"))).toBe("WINNING");
    expect(verdictFor(ticket("LOST"))).toBe("LOSING");
    expect(verdictFor(ticket("PAID"))).toBe("ALREADY_PAID");
    expect(verdictFor(ticket("PENDING"))).toBe("OPEN");
    expect(verdictFor(ticket("OPEN"))).toBe("OPEN");
    expect(verdictFor(ticket("VOID"))).toBe("VOID");
  });

  it("allows a payout only for won or voided tickets", () => {
    expect(isPayable(ticket("WON"))).toBe(true);
    expect(isPayable(ticket("VOID"))).toBe(true);

    for (const status of ["OPEN", "PENDING", "LOST", "PAID", "CANCELLED", "EXPIRED"] as const) {
      expect(isPayable(ticket(status))).toBe(false);
    }
  });
});
