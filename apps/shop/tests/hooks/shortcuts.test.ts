import { describe, expect, it } from "vitest";
import { shouldRunShortcut } from "../../src/hooks/useShortcuts";

function keyOn(target: EventTarget, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  let captured: KeyboardEvent | undefined;

  target.addEventListener("keydown", (event) => {
    captured = event as KeyboardEvent;
  }, { once: true });
  target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, ...init }));

  return captured as KeyboardEvent;
}

describe("shop shortcuts", () => {
  it("never fires a printable shortcut while the cashier is typing", () => {
    const input = document.createElement("input");
    const textarea = document.createElement("textarea");

    document.body.append(input, textarea);

    expect(shouldRunShortcut(keyOn(input, "/"))).toBe(false);
    expect(shouldRunShortcut(keyOn(textarea, "/"))).toBe(false);
    expect(shouldRunShortcut(keyOn(document.body, "/"))).toBe(true);
    input.remove();
    textarea.remove();
  });

  it("lets function keys through from a field, but not with modifiers or auto-repeat", () => {
    const input = document.createElement("input");

    document.body.append(input);

    expect(shouldRunShortcut(keyOn(input, "F7"))).toBe(true);
    expect(shouldRunShortcut(keyOn(input, "F7", { ctrlKey: true }))).toBe(false);
    expect(shouldRunShortcut(keyOn(input, "F4", { repeat: true }))).toBe(false);
    input.remove();
  });
});
