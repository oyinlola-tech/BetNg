import { afterEach, describe, expect, it, vi } from "vitest";
import { browserPrinter, getTicketPrinter, setTicketPrinter, type TicketPrinter } from "../../src/services/ticketPrinter";

afterEach(() => {
  setTicketPrinter(browserPrinter);
  vi.restoreAllMocks();
});

describe("TicketPrinter", () => {
  it("marks the document with the job kind while the browser prints, then clears it", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {
      expect(document.documentElement.dataset["print"]).toBe("ticket");
      window.dispatchEvent(new Event("afterprint"));
    });

    await browserPrinter.print({ kind: "ticket", reference: "F7WKPVSQDL" });

    expect(print).toHaveBeenCalledTimes(1);
    expect(document.documentElement.dataset["print"]).toBeUndefined();
  });

  it("lets a device implementation replace the browser one", async () => {
    const device: TicketPrinter = { name: "Receipt printer", print: vi.fn(() => Promise.resolve()) };

    setTicketPrinter(device);
    await getTicketPrinter().print({ kind: "report" });

    expect(device.print).toHaveBeenCalledWith({ kind: "report" });
  });
});
