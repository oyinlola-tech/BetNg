import { Buffer } from "node:buffer";
import type { StatementLine } from "../repositories/statements.repository.js";

export interface StatementDocument {
  readonly holder: string;
  readonly from: string;
  readonly to: string;
  readonly generatedAt: Date;
  readonly openingBalance: bigint;
  readonly lines: readonly StatementLine[];
  readonly truncated: boolean;
}

export function formatKobo(kobo: bigint): string {
  const sign = kobo < 0n ? "-" : "";
  const absolute = kobo < 0n ? -kobo : kobo;

  return `${sign}${(absolute / 100n).toString()}.${(absolute % 100n).toString().padStart(2, "0")}`;
}

function closing(document: StatementDocument): bigint {
  return document.lines.at(-1)?.balanceAfter ?? document.openingBalance;
}

/** A leading = + - @ tab or CR would make a spreadsheet evaluate the cell. */
function csvText(value: string): string {
  const safe = /^[=+\-@\t\r]/u.test(value) ? `'${value}` : value;

  return /[",\n\r]/u.test(safe) ? `"${safe.replace(/"/gu, '""')}"` : safe;
}

export function renderCsv(document: StatementDocument): Uint8Array {
  const rows = [
    "Date,Type,Reference,Description,Amount (NGN),Balance (NGN)",
    ["", "OPENING_BALANCE", "", csvText(`Statement ${document.from} to ${document.to}`), "", formatKobo(document.openingBalance)].join(","),
    ...document.lines.map((line) =>
      [
        line.createdAt.toISOString(),
        line.type,
        csvText(line.reference ?? ""),
        csvText(line.note ?? ""),
        formatKobo(line.amount),
        formatKobo(line.balanceAfter),
      ].join(","),
    ),
    ["", "CLOSING_BALANCE", "", document.truncated ? csvText("Truncated: request a shorter range") : "", "", formatKobo(closing(document))].join(","),
  ];

  return Buffer.from(`${rows.join("\r\n")}\r\n`, "utf8");
}

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 40;
const FONT_SIZE = 8;
const LEADING = 11;
const LINES_PER_PAGE = Math.floor((PAGE_HEIGHT - 2 * MARGIN) / LEADING);
const COLUMNS = 106;

function pdfText(value: string): string {
  return value
    .replace(/[^\x20-\x7E]/gu, "?")
    .replace(/[\\()]/gu, (character) => `\\${character}`);
}

function column(value: string, width: number, right = false): string {
  const clipped = value.length > width ? value.slice(0, width) : value;

  return right ? clipped.padStart(width) : clipped.padEnd(width);
}

function textLines(document: StatementDocument): string[] {
  const header = [
    "BetNG account statement",
    `Account holder: ${document.holder}`,
    `Period: ${document.from} to ${document.to} (UTC)`,
    `Generated: ${document.generatedAt.toISOString()}`,
    `Opening balance: NGN ${formatKobo(document.openingBalance)}`,
    `Closing balance: NGN ${formatKobo(closing(document))}`,
    "",
    [column("Date (UTC)", 20), column("Type", 20), column("Reference", 30), column("Amount", 16, true), column("Balance", 17, true)].join(" "),
    "-".repeat(COLUMNS),
  ];
  const body = document.lines.map((line) =>
    [
      column(line.createdAt.toISOString().replace("T", " ").slice(0, 19), 20),
      column(line.type, 20),
      column(line.reference ?? "", 30),
      column(formatKobo(line.amount), 16, true),
      column(formatKobo(line.balanceAfter), 17, true),
    ].join(" "),
  );

  return [
    ...header,
    ...(body.length === 0 ? ["No transactions in this period."] : body),
    ...(document.truncated ? ["", "This statement was truncated. Request a shorter period for the rest."] : []),
  ];
}

/** A minimal PDF 1.4: one Courier font, one content stream per page, byte offsets computed for the xref table. */
export function renderPdf(document: StatementDocument): Uint8Array {
  const lines = textLines(document);
  const pages: string[][] = [];

  for (let start = 0; start < lines.length; start += LINES_PER_PAGE) {
    pages.push(lines.slice(start, start + LINES_PER_PAGE));
  }

  const objects: string[] = [];
  const pageIds = pages.map((_, index) => 4 + index * 2);

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${String(id)} 0 R`).join(" ")}] /Count ${String(pages.length)} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>";

  pages.forEach((pageLines, index) => {
    const pageId = 4 + index * 2;
    const contentId = pageId + 1;
    const footer = `Page ${String(index + 1)} of ${String(pages.length)}`;
    const stream = [
      "BT",
      `/F1 ${String(FONT_SIZE)} Tf`,
      `${String(LEADING)} TL`,
      `${String(MARGIN)} ${String(PAGE_HEIGHT - MARGIN)} Td`,
      ...pageLines.map((line) => `(${pdfText(line)}) Tj T*`),
      "ET",
      "BT",
      `/F1 ${String(FONT_SIZE)} Tf`,
      `${String(MARGIN)} ${String(MARGIN / 2)} Td`,
      `(${pdfText(footer)}) Tj`,
      "ET",
    ].join("\n");

    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${String(PAGE_WIDTH)} ${String(PAGE_HEIGHT)}] ` +
      `/Resources << /Font << /F1 3 0 R >> >> /Contents ${String(contentId)} 0 R >>`;
    objects[contentId] = `<< /Length ${String(Buffer.byteLength(stream, "latin1"))} >>\nstream\n${stream}\nendstream`;
  });

  let output = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets: number[] = [];

  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = Buffer.byteLength(output, "latin1");
    output += `${String(id)} 0 obj\n${objects[id] ?? "null"}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(output, "latin1");
  const size = objects.length;

  output += `xref\n0 ${String(size)}\n0000000000 65535 f \n`;

  for (let id = 1; id < size; id += 1) {
    output += `${String(offsets[id] ?? 0).padStart(10, "0")} 00000 n \n`;
  }

  output += `trailer\n<< /Size ${String(size)} /Root 1 0 R >>\nstartxref\n${String(xrefOffset)}\n%%EOF\n`;

  return Buffer.from(output, "latin1");
}
