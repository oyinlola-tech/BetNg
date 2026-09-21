import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup, configure } from "@testing-library/react";

// Screens load their route and their data asynchronously; one second is too tight on a loaded machine.
configure({ asyncUtilTimeout: 5_000 });

afterEach(() => {
  cleanup();
});

// jsdom ships HTMLDialogElement without the modal methods.
if (typeof HTMLDialogElement !== "undefined") {
  const proto = HTMLDialogElement.prototype;

  if (typeof proto.showModal !== "function") {
    proto.showModal = function showModal(this: HTMLDialogElement): void {
      this.setAttribute("open", "");
    };
  }

  if (typeof proto.show !== "function") {
    proto.show = function show(this: HTMLDialogElement): void {
      this.setAttribute("open", "");
    };
  }

  if (typeof proto.close !== "function") {
    proto.close = function close(this: HTMLDialogElement): void {
      if (!this.hasAttribute("open")) return;

      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    };
  }
}

if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  });
}
