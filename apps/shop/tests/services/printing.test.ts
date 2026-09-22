import { describe, expect, it, vi } from "vitest";
import type { CashierShift, Ticket } from "@betng/contracts";
import { formatMoney } from "@betng/ui-core";
import { ESCPOS, encodeEscPos, toPrinterText } from "../../src/services/printing/escpos";
import { createBrowserPrinter, createDevelopmentPrinter, createNetworkPrinter, parseBridgeUrl, selectPrinterAdapter } from "../../src/services/printing/adapters";
import { ReceiptFormatError, formatReceipt, renderReceiptText, type ReceiptDocument } from "../../src/services/printing/receipt";

const TICKET = {
  id: "t1",
  code: "BNG-7K2QX9",
  shopCode: "BNG-LAG-001",
  cashierId: "c1",
  cashierName: "Bisi Adeyemi",
  status: "OPEN",
  placedAt: "2026-09-21T10:00:00.000Z",
  expiresAt: "2026-10-21T10:00:00.000Z",
  stake: 100_000,
  totalOdds: 3.4,
  potentialPayout: 340_000,
  selections: [
    { matchId: "m1", marketId: "k1", selectionId: "s1", odds: 1.7, marketType: "1X2", marketLabel: "Match result", selectionLabel: "Home", matchLabel: "Lagos Lions v Abuja Stars", leagueName: "Premier", kickoffAt: "2026-09-21T11:00:00.000Z", outcome: "PENDING" },
    { matchId: "m2", marketId: "k2", selectionId: "s2", odds: 2, marketType: "GG", marketLabel: "Both teams to score", selectionLabel: "Yes", matchLabel: "Kano Kings v Enugu Eagles", leagueName: "Premier", kickoffAt: "2026-09-21T11:00:00.000Z", outcome: "PENDING" },
  ],
} as unknown as Ticket;

const SHIFT: CashierShift = {
  id: "0f3a9c21-shift",
  cashierId: "c1",
  cashierName: "Bisi Adeyemi",
  status: "CLOSED",
  openedAt: "2026-09-21T08:00:00.000Z",
  closedAt: "2026-09-21T16:00:00.000Z",
  totals: { openingFloat: 2_000_000, sales: 500_000, payouts: 100_000, cancellations: 0, cashIn: 0, cashOut: 0, expectedCash: 2_400_000, ticketsSold: 3 },
  countedCash: 2_350_000,
  discrepancy: -50_000,
};

function indexOfSequence(bytes: Uint8Array, sequence: readonly number[]): number {
  outer: for (let i = 0; i <= bytes.length - sequence.length; i += 1) {
    for (let j = 0; j < sequence.length; j += 1) if (bytes[i + j] !== sequence[j]) continue outer;

    return i;
  }

  return -1;
}

describe("receipt formatting", () => {
  it("copies the platform's figures onto the ticket receipt", () => {
    const text = renderReceiptText(formatReceipt({ kind: "ticket", ticket: TICKET }));

    expect(text).toContain("BNG-7K2QX9");
    expect(text).toContain(formatMoney(340_000));
    expect(text).toContain("Lagos Lions v Abuja Stars");
    expect(text).toContain("Match result: Home");
  });

  it("keeps every line within the paper width", () => {
    const doc = formatReceipt({ kind: "ticket", ticket: TICKET }, 32);

    for (const row of renderReceiptText(doc).split("\n")) expect(row.length).toBeLessThanOrEqual(32);
  });

  it("refuses a payout receipt until the platform has confirmed the payout", () => {
    expect(() => formatReceipt({ kind: "payout", ticket: TICKET })).toThrow(ReceiptFormatError);

    const paid = { ...TICKET, status: "PAID", payout: 340_000, paidAt: "2026-09-21T15:00:00.000Z" } as Ticket;

    expect(renderReceiptText(formatReceipt({ kind: "payout", ticket: paid }))).toContain(`Paid out`);
  });

  it("prints the shift's discrepancy exactly as the platform reported it", () => {
    const text = renderReceiptText(formatReceipt({ kind: "shift", shift: SHIFT }));

    expect(text).toContain(formatMoney(2_400_000));
    expect(text).toMatch(/Discrepancy\s+-/);
    expect(text).toContain(formatMoney(2_350_000));
  });
});

describe("ESC/POS encoder", () => {
  const doc: ReceiptDocument = {
    kind: "ticket",
    reference: "BNG-1",
    columns: 32,
    lines: [
      { kind: "text", text: "BETNG", align: "center", bold: true, large: true },
      { kind: "pair", label: "Stake", value: "₦1,000.00" },
      { kind: "barcode", value: "BNG-7K2QX9" },
      { kind: "feed", lines: 3 },
      { kind: "cut" },
    ],
  };

  it("initialises the printer, then sets alignment, emphasis and size", () => {
    const bytes = encodeEscPos(doc);

    expect([...bytes.slice(0, 2)]).toEqual([0x1b, 0x40]);
    expect(indexOfSequence(bytes, [0x1b, 0x61, 1, 0x1b, 0x45, 1, 0x1d, 0x21, 0x11])).toBeGreaterThan(0);
  });

  it("transliterates the naira sign for a single-byte code page", () => {
    const bytes = encodeEscPos(doc);

    expect(toPrinterText("₦1,000")).toBe("N1,000");
    expect(indexOfSequence(bytes, [..."N1,000.00"].map((c) => c.charCodeAt(0)))).toBeGreaterThan(0);
    expect([...bytes].every((b) => b < 0x80)).toBe(true);
  });

  it("encodes the ticket reference as a Code 39 barcode", () => {
    const bytes = encodeEscPos(doc);
    const data = [..."BNG-7K2QX9"].map((c) => c.charCodeAt(0));

    expect(indexOfSequence(bytes, [0x1d, 0x6b, 69, data.length, ...data])).toBeGreaterThan(0);
  });

  it("falls back to text for a reference Code 39 cannot carry", () => {
    const bytes = encodeEscPos({ ...doc, lines: [{ kind: "barcode", value: "bad*ref" }] });

    expect(indexOfSequence(bytes, [0x1d, 0x6b])).toBe(-1);
    expect(indexOfSequence(bytes, [..."BAD*REF"].map((c) => c.charCodeAt(0)))).toBeGreaterThan(0);
  });

  it("feeds and cuts at the end", () => {
    const bytes = encodeEscPos(doc);

    expect([...bytes.slice(-7)]).toEqual([...ESCPOS.feed(3), ...ESCPOS.cut]);
  });
});

describe("printer adapters", () => {
  it("accepts only a bridge on this machine", () => {
    expect(parseBridgeUrl("http://localhost:9100")?.port).toBe("9100");
    expect(parseBridgeUrl("http://127.0.0.1:9100/")).toBeDefined();
    expect(parseBridgeUrl("http://[::1]:9100")).toBeDefined();
    expect(parseBridgeUrl("http://printer.local:9100")).toBeUndefined();
    expect(parseBridgeUrl("http://192.168.1.20:9100")).toBeUndefined();
    expect(parseBridgeUrl("http://localhost.evil.com")).toBeUndefined();
    expect(parseBridgeUrl("http://user:pw@localhost:9100")).toBeUndefined();
    expect(parseBridgeUrl("file:///tmp/printer")).toBeUndefined();
    expect(parseBridgeUrl("")).toBeUndefined();
    expect(parseBridgeUrl(undefined)).toBeUndefined();
  });

  it("selects the configured adapter and falls back to the browser dialog when it cannot be used", () => {
    const logger = { info: vi.fn() };

    expect(selectPrinterAdapter({ kind: undefined, bridgeUrl: undefined, development: false }, { logger }).adapter.kind).toBe("browser");
    expect(selectPrinterAdapter({ kind: "network", bridgeUrl: "http://127.0.0.1:9100", development: false }, { logger }).adapter.kind).toBe("network");

    const remote = selectPrinterAdapter({ kind: "network", bridgeUrl: "http://10.0.0.5:9100", development: false }, { logger });

    expect(remote.adapter.kind).toBe("browser");
    expect(remote.problem).toMatch(/localhost/);
    expect(selectPrinterAdapter({ kind: "development", bridgeUrl: undefined, development: true }, { logger }).adapter.kind).toBe("development");
    expect(selectPrinterAdapter({ kind: "development", bridgeUrl: undefined, development: false }, { logger }).adapter.kind).toBe("browser");
    expect(selectPrinterAdapter({ kind: "laser", bridgeUrl: undefined, development: false }, { logger }).problem).toMatch(/Unknown/);
  });

  it("posts ESC/POS bytes to the bridge without credentials", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(() => Promise.resolve(new Response(null, { status: 204 })));
    const printer = createNetworkPrinter({ bridgeUrl: "http://127.0.0.1:9100", fetch });
    const doc = formatReceipt({ kind: "ticket", ticket: TICKET });

    await printer.print(doc);

    const [url, init] = fetch.mock.calls[0] ?? [];

    expect(url).toBe("http://127.0.0.1:9100/print");
    expect(init?.method).toBe("POST");
    expect(init?.credentials).toBe("omit");
    expect(init?.body).toEqual(encodeEscPos(doc));
  });

  it("reports a bridge failure instead of pretending the receipt printed", async () => {
    const printer = createNetworkPrinter({ bridgeUrl: "http://localhost:9100", fetch: vi.fn(() => Promise.resolve(new Response(null, { status: 500 }))) });

    await expect(printer.print(formatReceipt({ kind: "ticket", ticket: TICKET }))).rejects.toMatchObject({ name: "PrinterError", message: expect.stringMatching(/refused/) as unknown });
    await expect(createNetworkPrinter({ bridgeUrl: undefined }).print(formatReceipt({ kind: "ticket", ticket: TICKET }))).rejects.toMatchObject({ message: expect.stringMatching(/No local receipt printer/) as unknown });
  });

  it("prints from an isolated frame and removes it afterwards", async () => {
    let captured = "";
    const printer = createBrowserPrinter({
      invokePrint: (frame) => {
        captured = frame.document.body.textContent;
        frame.dispatchEvent(new Event("afterprint"));
      },
    });

    await printer.print(formatReceipt({ kind: "ticket", ticket: { ...TICKET, cashierName: "<img src=x onerror=alert(1)>" } }));

    expect(captured).toContain("BNG-7K2QX9");
    expect(captured).toContain("<img src=x onerror=alert(1)>");
    expect(document.querySelector("iframe")).toBeNull();
  });

  it("logs a text rendering from the development printer only when enabled", async () => {
    const logger = { info: vi.fn() };
    const doc = formatReceipt({ kind: "shift", shift: SHIFT });

    await createDevelopmentPrinter({ logger, enabled: true }).print(doc);
    expect(logger.info.mock.calls[0]?.[1]).toContain("Shift summary");
    await expect(createDevelopmentPrinter({ logger, enabled: false }).print(doc)).rejects.toThrow();
  });
});
