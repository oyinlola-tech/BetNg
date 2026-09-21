import type { PrinterConfig } from "../services/printing/adapters";

export const printerConfig: PrinterConfig = {
  kind: import.meta.env.VITE_PRINTER,
  bridgeUrl: import.meta.env.VITE_PRINTER_BRIDGE_URL,
  development: import.meta.env.DEV,
};
