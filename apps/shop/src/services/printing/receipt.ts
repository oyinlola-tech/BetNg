import type { CashierShift, Ticket } from "@betng/contracts";
import { formatDateTime, formatKickoffTime, formatMoney, formatOdds, formatSignedMoney } from "@betng/ui-core";

export type Align = "left" | "center" | "right";

export type ReceiptLine =
  | { readonly kind: "text"; readonly text: string; readonly align?: Align; readonly bold?: boolean; readonly large?: boolean }
  | { readonly kind: "pair"; readonly label: string; readonly value: string; readonly bold?: boolean }
  | { readonly kind: "rule" }
  | { readonly kind: "barcode"; readonly value: string }
  | { readonly kind: "feed"; readonly lines: number }
  | { readonly kind: "cut" };

export type ReceiptKind = "ticket" | "payout" | "shift";

/** A device-neutral receipt: every adapter renders the same lines, so what the customer holds never depends on the printer model. */
export interface ReceiptDocument {
  readonly kind: ReceiptKind;
  readonly reference: string;
  readonly columns: number;
  readonly lines: readonly ReceiptLine[];
}

export type ReceiptJob =
  | { readonly kind: "ticket"; readonly ticket: Ticket }
  | { readonly kind: "payout"; readonly ticket: Ticket; readonly refund?: boolean }
  | { readonly kind: "shift"; readonly shift: CashierShift };

export class ReceiptFormatError extends Error {
  override readonly name = "ReceiptFormatError";
}

export const DEFAULT_COLUMNS = 42;

const SHIFT_STATUS: Readonly<Record<CashierShift["status"], string>> = { OPEN: "Open", CLOSING: "Closing", CLOSED: "Closed", RECONCILED: "Reconciled" };

function header(title: string): ReceiptLine[] {
  return [
    { kind: "text", text: "BETNG", align: "center", bold: true, large: true },
    { kind: "text", text: title, align: "center", bold: true },
    { kind: "rule" },
  ];
}

const FOOTER: readonly ReceiptLine[] = [
  { kind: "text", text: "Simulated platform: play money only, no cash value.", align: "center" },
  { kind: "feed", lines: 3 },
  { kind: "cut" },
];

function ticketLines(ticket: Ticket): ReceiptLine[] {
  const legs = ticket.selections.flatMap((leg, index): ReceiptLine[] => [
    { kind: "text", text: `${String(index + 1).padStart(2, "0")} ${leg.leagueName} ${formatKickoffTime(leg.kickoffAt)}` },
    { kind: "text", text: leg.matchLabel, bold: true },
    { kind: "pair", label: `${leg.marketLabel}: ${leg.selectionLabel}`, value: formatOdds(leg.odds) },
  ]);

  return [
    ...header("Bet ticket"),
    { kind: "text", text: ticket.code, align: "center", bold: true, large: true },
    { kind: "pair", label: "Shop", value: ticket.shopCode },
    { kind: "pair", label: "Cashier", value: ticket.cashierName },
    { kind: "pair", label: "Placed", value: formatDateTime(ticket.placedAt) },
    ...(ticket.customerName === undefined ? [] : [{ kind: "pair", label: "Customer", value: ticket.customerName } as const]),
    { kind: "rule" },
    ...legs,
    { kind: "rule" },
    { kind: "pair", label: `Total odds (${String(ticket.selections.length)})`, value: formatOdds(ticket.totalOdds) },
    { kind: "pair", label: "Stake", value: formatMoney(ticket.stake) },
    { kind: "pair", label: "Potential payout", value: formatMoney(ticket.potentialPayout), bold: true },
    { kind: "rule" },
    { kind: "barcode", value: ticket.code },
    { kind: "text", text: `Collect by ${formatDateTime(ticket.expiresAt)}`, align: "center" },
    ...FOOTER,
  ];
}

function payoutLines(ticket: Ticket, refund: boolean): ReceiptLine[] {
  if (ticket.status !== "PAID" || ticket.payout === undefined) throw new ReceiptFormatError("A payout receipt needs the platform's confirmed payout.");

  return [
    ...header(refund ? "Refund receipt" : "Payout receipt"),
    { kind: "pair", label: "Ticket", value: ticket.code, bold: true },
    { kind: "pair", label: "Shop", value: ticket.shopCode },
    { kind: "pair", label: "Stake", value: formatMoney(ticket.stake) },
    ...(ticket.paidAt === undefined ? [] : [{ kind: "pair", label: "Paid at", value: formatDateTime(ticket.paidAt) } as const]),
    { kind: "rule" },
    { kind: "pair", label: refund ? "Refunded" : "Paid out", value: formatMoney(ticket.payout), bold: true },
    { kind: "rule" },
    { kind: "barcode", value: ticket.code },
    ...FOOTER,
  ];
}

function shiftLines(shift: CashierShift): ReceiptLine[] {
  const t = shift.totals;

  return [
    ...header("Shift summary"),
    { kind: "pair", label: "Cashier", value: shift.cashierName },
    { kind: "pair", label: "Status", value: SHIFT_STATUS[shift.status] },
    { kind: "pair", label: "Opened", value: formatDateTime(shift.openedAt) },
    ...(shift.closedAt === undefined ? [] : [{ kind: "pair", label: "Closed", value: formatDateTime(shift.closedAt) } as const]),
    { kind: "rule" },
    { kind: "pair", label: "Opening float", value: formatMoney(t.openingFloat) },
    { kind: "pair", label: `Sales (${String(t.ticketsSold)} tickets)`, value: formatMoney(t.sales) },
    { kind: "pair", label: "Payouts", value: formatMoney(t.payouts) },
    { kind: "pair", label: "Cancellations", value: formatMoney(t.cancellations) },
    { kind: "pair", label: "Cash in", value: formatMoney(t.cashIn) },
    { kind: "pair", label: "Cash out", value: formatMoney(t.cashOut) },
    { kind: "pair", label: "Expected cash", value: formatMoney(t.expectedCash), bold: true },
    ...(shift.countedCash === undefined ? [] : [{ kind: "pair", label: "Counted cash", value: formatMoney(shift.countedCash) } as const]),
    ...(shift.discrepancy === undefined ? [] : [{ kind: "pair", label: "Discrepancy", value: formatSignedMoney(shift.discrepancy), bold: true } as const]),
    ...(shift.discrepancyNote === undefined || shift.discrepancyNote === "" ? [] : [{ kind: "text", text: `Note: ${shift.discrepancyNote}` } as const]),
    { kind: "rule" },
    { kind: "text", text: `Shift ${shift.id.slice(0, 8).toUpperCase()}`, align: "center" },
    ...FOOTER,
  ];
}

/** Turns platform records into a receipt. Every figure is copied from the record; nothing is recomputed here. */
export function formatReceipt(job: ReceiptJob, columns = DEFAULT_COLUMNS): ReceiptDocument {
  switch (job.kind) {
    case "ticket":
      return { kind: "ticket", reference: job.ticket.code, columns, lines: ticketLines(job.ticket) };
    case "payout":
      return { kind: "payout", reference: job.ticket.code, columns, lines: payoutLines(job.ticket, job.refund === true) };
    case "shift":
      return { kind: "shift", reference: job.shift.id, columns, lines: shiftLines(job.shift) };
  }
}

export function wrapText(text: string, width: number): string[] {
  const rows: string[] = [];
  let row = "";

  for (const word of text.split(/\s+/).filter((w) => w !== "")) {
    let rest = word;

    while (rest.length > width) {
      if (row !== "") {
        rows.push(row);
        row = "";
      }
      rows.push(rest.slice(0, width));
      rest = rest.slice(width);
    }

    if (row === "") row = rest;
    else if (row.length + 1 + rest.length <= width) row = `${row} ${rest}`;
    else {
      rows.push(row);
      row = rest;
    }
  }

  if (row !== "" || rows.length === 0) rows.push(row);

  return rows;
}

export function alignRow(text: string, width: number, align: Align = "left"): string {
  if (align === "left" || text.length >= width) return text;

  const gap = width - text.length;

  return align === "right" ? `${" ".repeat(gap)}${text}` : `${" ".repeat(Math.floor(gap / 2))}${text}`;
}

export function pairRow(label: string, value: string, width: number): string[] {
  if (label.length + 1 + value.length <= width) return [`${label}${" ".repeat(width - label.length - value.length)}${value}`];

  return [...wrapText(label, width), alignRow(value, width, "right")];
}

/** Plain-text rendering, as the printer would lay it out in a fixed-width font. */
export function renderReceiptText(doc: ReceiptDocument): string {
  const out: string[] = [];

  for (const line of doc.lines) {
    switch (line.kind) {
      case "text": {
        const width = line.large === true ? Math.floor(doc.columns / 2) : doc.columns;

        for (const row of wrapText(line.text, width)) out.push(alignRow(row, doc.columns, line.align));
        break;
      }
      case "pair":
        out.push(...pairRow(line.label, line.value, doc.columns));
        break;
      case "rule":
        out.push("-".repeat(doc.columns));
        break;
      case "barcode":
        out.push(alignRow(`|| ${line.value} ||`, doc.columns, "center"));
        break;
      case "feed":
        for (let i = 0; i < line.lines; i += 1) out.push("");
        break;
      case "cut":
        out.push("=".repeat(doc.columns));
        break;
    }
  }

  return out.join("\n");
}
