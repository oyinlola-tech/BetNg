import type { Logger } from "@betng/ui-core";
import { encodeCode39 } from "../../lib/code39";
import { encodeEscPos } from "./escpos";
import { renderReceiptText, type ReceiptDocument, type ReceiptLine } from "./receipt";

export type PrinterKind = "browser" | "network" | "development";

export interface PrinterAdapter {
  readonly kind: PrinterKind;
  readonly name: string;
  readonly available: boolean;
  print(doc: ReceiptDocument): Promise<void>;
}

export class PrinterError extends Error {
  override readonly name = "PrinterError";
}

const RECEIPT_CSS = `
@page { size: 80mm auto; margin: 0; }
* { box-sizing: border-box; }
body { margin: 0; padding: 4mm; width: 80mm; color: #000; background: #fff; font: 12px/1.35 ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace; }
p { margin: 0; white-space: pre-wrap; word-break: break-word; }
.center { text-align: center; } .right { text-align: right; } .bold { font-weight: 700; } .large { font-size: 20px; }
.pair { display: flex; justify-content: space-between; gap: 8px; } .pair span:last-child { text-align: right; }
hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
svg { display: block; width: 100%; height: 40px; margin: 6px 0 2px; }
.feed { height: 1.35em; } .cut { border-top: 1px dotted #000; margin-top: 8px; }
`;

const SVG_NS = "http://www.w3.org/2000/svg";

function renderLine(doc: Document, line: ReceiptLine): HTMLElement | SVGElement | undefined {
  switch (line.kind) {
    case "text": {
      const p = doc.createElement("p");

      p.textContent = line.text;
      p.className = [line.align ?? "left", line.bold === true ? "bold" : "", line.large === true ? "large" : ""].join(" ").trim();

      return p;
    }
    case "pair": {
      const p = doc.createElement("p");
      const label = doc.createElement("span");
      const value = doc.createElement("span");

      label.textContent = line.label;
      value.textContent = line.value;
      p.className = line.bold === true ? "pair bold" : "pair";
      p.append(label, value);

      return p;
    }
    case "rule":
      return doc.createElement("hr");
    case "barcode": {
      const code = encodeCode39(line.value);

      if (code === undefined) return undefined;

      const svg = doc.createElementNS(SVG_NS, "svg");

      svg.setAttribute("viewBox", `-10 0 ${String(code.width + 20)} 24`);
      svg.setAttribute("preserveAspectRatio", "none");
      for (const bar of code.bars) {
        const rect = doc.createElementNS(SVG_NS, "rect");

        rect.setAttribute("x", String(bar.x));
        rect.setAttribute("width", String(bar.width));
        rect.setAttribute("height", "24");
        svg.append(rect);
      }

      return svg;
    }
    case "feed": {
      const div = doc.createElement("div");

      div.className = "feed";
      div.style.height = `${String(1.35 * line.lines)}em`;

      return div;
    }
    case "cut": {
      const div = doc.createElement("div");

      div.className = "cut";

      return div;
    }
  }
}

/** Builds the receipt with DOM nodes and text content only, so nothing from a record is ever parsed as markup. */
export function renderReceiptInto(target: Document, doc: ReceiptDocument): void {
  const style = target.createElement("style");

  style.textContent = RECEIPT_CSS;
  target.head.append(style);
  target.title = `${doc.kind} ${doc.reference}`;

  for (const line of doc.lines) {
    const node = renderLine(target, line);

    if (node !== undefined) target.body.append(node);
  }
}

export interface BrowserPrinterOptions {
  readonly document?: Document;
  readonly invokePrint?: (frame: Window) => void;
  readonly fallbackMs?: number;
}

/** The system print dialog, fed from an isolated frame so the terminal screen itself is never what prints. */
export function createBrowserPrinter({ document: host, invokePrint = (frame) => frame.print(), fallbackMs = 60_000 }: BrowserPrinterOptions = {}): PrinterAdapter {
  return {
    kind: "browser",
    name: "Browser print dialog",
    available: true,
    print: (doc) =>
      new Promise((resolve, reject) => {
        const owner = host ?? document;
        const frame = owner.createElement("iframe");

        frame.setAttribute("aria-hidden", "true");
        frame.setAttribute("tabindex", "-1");
        frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
        owner.body.append(frame);

        const view = frame.contentWindow;
        const target = frame.contentDocument;

        if (view === null || target === null) {
          frame.remove();
          reject(new PrinterError("The print frame could not be created."));

          return;
        }

        renderReceiptInto(target, doc);

        let settled = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const done = (): void => {
          if (settled) return;
          settled = true;
          if (timer !== undefined) clearTimeout(timer);
          view.removeEventListener("afterprint", done);
          frame.remove();
          resolve();
        };

        view.addEventListener("afterprint", done);
        timer = setTimeout(done, fallbackMs);

        try {
          invokePrint(view);
        } catch (cause) {
          settled = true;
          clearTimeout(timer);
          frame.remove();
          reject(new PrinterError(cause instanceof Error ? cause.message : "The browser could not print."));
        }
      }),
  };
}

const BRIDGE_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** The receipt bridge must run on this machine: http(s) on localhost or the loopback address, with no credentials in the URL. */
export function parseBridgeUrl(raw: string | undefined): URL | undefined {
  if (raw === undefined || raw.trim() === "") return undefined;

  let url: URL;

  try {
    url = new URL(raw.trim());
  } catch {
    return undefined;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
  if (url.username !== "" || url.password !== "" || url.search !== "" || url.hash !== "") return undefined;
  if (!BRIDGE_HOSTS.has(url.hostname.toLowerCase())) return undefined;

  return url;
}

export interface NetworkPrinterOptions {
  readonly bridgeUrl: string | undefined;
  readonly fetch?: typeof fetch;
  readonly timeoutMs?: number;
}

/** ESC/POS bytes posted to a local bridge that owns the USB or LAN receipt printer. */
export function createNetworkPrinter({ bridgeUrl, fetch: send = (...args) => fetch(...args), timeoutMs = 8_000 }: NetworkPrinterOptions): PrinterAdapter {
  const base = parseBridgeUrl(bridgeUrl);

  return {
    kind: "network",
    name: "Receipt printer (ESC/POS)",
    available: base !== undefined,
    print: async (doc) => {
      if (base === undefined) throw new PrinterError("No local receipt printer bridge is configured.");

      const endpoint = new URL("print", base.href.endsWith("/") ? base : `${base.href}/`);
      let response: Response;

      try {
        response = await send(endpoint.href, {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: encodeEscPos(doc),
          credentials: "omit",
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch {
        throw new PrinterError("The receipt printer did not respond. Check that it is on and connected.");
      }

      if (!response.ok) throw new PrinterError(`The receipt printer refused the job (${String(response.status)}).`);
    },
  };
}

/** Writes the receipt as text to the log instead of printing. Development builds only. */
export function createDevelopmentPrinter({ logger, enabled }: { readonly logger: Pick<Logger, "info">; readonly enabled: boolean }): PrinterAdapter {
  return {
    kind: "development",
    name: "Development printer (log only)",
    available: enabled,
    print: async (doc) => {
      if (!enabled) throw new PrinterError("The development printer is not available in this build.");
      logger.info("ui", `Receipt ${doc.kind} ${doc.reference}\n${renderReceiptText(doc)}`);
      await Promise.resolve();
    },
  };
}

export interface PrinterSelection {
  readonly adapter: PrinterAdapter;
  readonly problem?: string;
}

export interface PrinterConfig {
  readonly kind: string | undefined;
  readonly bridgeUrl: string | undefined;
  readonly development: boolean;
}

export function selectPrinterAdapter(config: PrinterConfig, deps: { readonly logger: Pick<Logger, "info">; readonly fetch?: typeof fetch; readonly document?: Document }): PrinterSelection {
  const browser = createBrowserPrinter(deps.document === undefined ? {} : { document: deps.document });
  const kind = (config.kind ?? "browser").trim().toLowerCase();

  if (kind === "network") {
    const network = createNetworkPrinter({ bridgeUrl: config.bridgeUrl, ...(deps.fetch === undefined ? {} : { fetch: deps.fetch }) });

    return network.available ? { adapter: network } : { adapter: browser, problem: "VITE_PRINTER_BRIDGE_URL must be an http://localhost or http://127.0.0.1 address; printing uses the browser dialog." };
  }

  if (kind === "development") {
    return config.development ? { adapter: createDevelopmentPrinter({ logger: deps.logger, enabled: true }) } : { adapter: browser, problem: "The development printer is only available in development; printing uses the browser dialog." };
  }

  if (kind !== "browser" && kind !== "") return { adapter: browser, problem: `Unknown VITE_PRINTER "${kind}"; printing uses the browser dialog.` };

  return { adapter: browser };
}
