export type PrintKind = "ticket" | "payout-receipt" | "report";

export interface PrintJob {
  readonly kind: PrintKind;
  /** The platform-issued reference the document is about, when it has one. */
  readonly reference?: string;
}

/** Where a shop document goes to be printed. The browser implementation is the only one today; a receipt-printer driver implements the same interface. */
export interface TicketPrinter {
  readonly name: string;
  print(job: PrintJob): Promise<void>;
}

export const browserPrinter: TicketPrinter = {
  name: "Browser print dialog",
  print: (job) =>
    new Promise((resolve) => {
      const root = document.documentElement;
      const done = (): void => {
        delete root.dataset["print"];
        window.removeEventListener("afterprint", done);
        resolve();
      };

      root.dataset["print"] = job.kind;
      window.addEventListener("afterprint", done);
      window.print();
    }),
};

let active: TicketPrinter = browserPrinter;

export function getTicketPrinter(): TicketPrinter {
  return active;
}

export function setTicketPrinter(printer: TicketPrinter): void {
  active = printer;
}
