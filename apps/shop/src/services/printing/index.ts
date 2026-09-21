import { printerConfig } from "../../configs/printer";
import { logger } from "../logger";
import { selectPrinterAdapter, type PrinterAdapter } from "./adapters";
import { formatReceipt, type ReceiptJob } from "./receipt";

export { PrinterError, createBrowserPrinter, createDevelopmentPrinter, createNetworkPrinter, parseBridgeUrl, selectPrinterAdapter } from "./adapters";
export type { PrinterAdapter, PrinterConfig, PrinterKind, PrinterSelection } from "./adapters";
export { ReceiptFormatError, formatReceipt, renderReceiptText } from "./receipt";
export type { ReceiptDocument, ReceiptJob, ReceiptLine } from "./receipt";

let active: PrinterAdapter | undefined;

export function getPrinterAdapter(): PrinterAdapter {
  if (active === undefined) {
    const selection = selectPrinterAdapter(printerConfig, { logger });

    if (selection.problem !== undefined) logger.warn("flow", selection.problem);
    active = selection.adapter;
  }

  return active;
}

export function setPrinterAdapter(adapter: PrinterAdapter): void {
  active = adapter;
}

/** Formats a platform record as a receipt and sends it to the configured printer. */
export async function printReceipt(job: ReceiptJob): Promise<void> {
  await getPrinterAdapter().print(formatReceipt(job));
}

/** Full-page reports go through the browser dialog whatever the receipt printer is. */
export function printPage(): void {
  window.print();
}
