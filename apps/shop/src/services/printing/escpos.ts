import { encodeCode39 } from "../../lib/code39";
import { pairRow, wrapText, type Align, type ReceiptDocument } from "./receipt";

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

export const ESCPOS = {
  init: [ESC, 0x40],
  align: (align: Align): number[] => [ESC, 0x61, align === "left" ? 0 : align === "center" ? 1 : 2],
  bold: (on: boolean): number[] => [ESC, 0x45, on ? 1 : 0],
  size: (large: boolean): number[] => [GS, 0x21, large ? 0x11 : 0x00],
  feed: (lines: number): number[] => [ESC, 0x64, Math.max(0, Math.min(255, Math.trunc(lines)))],
  /** Feed to the cutter, then a partial cut. */
  cut: [GS, 0x56, 0x42, 0x00],
  code39: (data: string): number[] => [GS, 0x68, 80, GS, 0x77, 2, GS, 0x48, 2, GS, 0x6b, 69, data.length, ...ascii(data)],
} as const;

const REPLACEMENTS: Readonly<Record<string, string>> = { "\u20a6": "N", "\u00b7": "-", "\u2013": "-", "\u2014": "-", "\u2018": "'", "\u2019": "'", "\u201c": '"', "\u201d": '"', "\u2026": "...", "\u00a0": " ", "\u202f": " " };

/** Printers run a single-byte code page; anything outside printable ASCII is transliterated or replaced. */
export function toPrinterText(text: string): string {
  return [...text].map((c) => REPLACEMENTS[c] ?? (c >= " " && c <= "~" ? c : "?")).join("");
}

function ascii(text: string): number[] {
  return [...toPrinterText(text)].map((c) => c.charCodeAt(0));
}

export function encodeEscPos(doc: ReceiptDocument): Uint8Array<ArrayBuffer> {
  const out: number[] = [...ESCPOS.init];
  const push = (...parts: readonly (readonly number[])[]): void => {
    for (const part of parts) out.push(...part);
  };

  for (const line of doc.lines) {
    switch (line.kind) {
      case "text": {
        const large = line.large === true;
        const width = large ? Math.floor(doc.columns / 2) : doc.columns;

        push(ESCPOS.align(line.align ?? "left"), ESCPOS.bold(line.bold === true), ESCPOS.size(large));
        for (const row of wrapText(toPrinterText(line.text), width)) push(ascii(row), [LF]);
        push(ESCPOS.size(false), ESCPOS.bold(false));
        break;
      }
      case "pair":
        push(ESCPOS.align("left"), ESCPOS.bold(line.bold === true));
        for (const row of pairRow(toPrinterText(line.label), toPrinterText(line.value), doc.columns)) push(ascii(row), [LF]);
        push(ESCPOS.bold(false));
        break;
      case "rule":
        push(ESCPOS.align("left"), ascii("-".repeat(doc.columns)), [LF]);
        break;
      case "barcode": {
        const data = line.value.trim().toUpperCase();

        push(ESCPOS.align("center"));
        if (encodeCode39(data) !== undefined && data.length <= 255) push(ESCPOS.code39(data), [LF]);
        else push(ascii(data), [LF]);
        push(ESCPOS.align("left"));
        break;
      }
      case "feed":
        push(ESCPOS.feed(line.lines));
        break;
      case "cut":
        push(ESCPOS.cut);
        break;
    }
  }

  return Uint8Array.from(out);
}
